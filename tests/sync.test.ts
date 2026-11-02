import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, type App } from "../server/src/app";
import { remindersFor, ReminderScheduler } from "../server/src/reminders";
import { SyncStore } from "../server/src/store";
import { Engine } from "../src/main/engine";
import type { Device } from "../src/main/store";
import { SyncClient } from "../src/main/sync";
import { DEFAULT_DEVICE_SETTINGS, defaultState, emptyData, type CtdpData } from "../src/shared/ctdp";
import { DESK, MIN, T0, desk, seatFocus } from "./helpers";

const TOKEN = "test-token-0123456789";

let app: App;
let store: SyncStore;
let url: string;
let pushed: string[];
let clients: SyncClient[];

beforeEach(async () => {
  store = new SyncStore(":memory:");
  pushed = [];
  app = createApp({ token: TOKEN, store, push: { publicKey: "pk", send: async (r) => void pushed.push(r.title) } });
  await new Promise<void>((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  clients = [];
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
});

afterEach(async () => {
  vi.useRealTimers();
  for (const c of clients) c.stop();
  await app.close();
  store.close();
});

function makeDevice(id: string, data: CtdpData = emptyData(), confirm = true) {
  const device: Device = { id, seq: 0, settings: { ...DEFAULT_DEVICE_SETTINGS }, sync: null, seenVoided: [] };
  const engine = new Engine(data, device, { data: () => {}, device: () => {} });
  const backups: CtdpData[] = [];
  const client = new SyncClient({
    engine,
    device,
    saveDevice: () => {},
    confirmReplace: async () => confirm,
    backup: (d) => {
      backups.push(d);
      return "backup.json";
    },
    intervalMs: 60_000,
  });
  clients.push(client);
  return { device, engine, client, backups };
}

const at = (minutes: number) => vi.setSystemTime(T0 + minutes * MIN);

describe("sync between devices", () => {
  it("seeds an empty server, then a second device joins and both converge", async () => {
    const pc = makeDevice("pc");
    pc.engine.dispatch({ type: "saveCategory", categoryId: null, name: "Reading" });
    expect((await pc.client.connect(url, TOKEN)).ok).toBe(true);

    const phone = makeDevice("phone");
    expect((await phone.client.connect(`${url}/`, TOKEN)).ok).toBe(true);
    expect(phone.engine.get().categories.map((c) => c.name)).toContain("Reading");

    at(1);
    phone.engine.dispatch({ type: "reserve", chainId: DESK });
    await phone.client.syncNow();
    await pc.client.syncNow();
    expect(pc.engine.get().reservation?.chainId).toBe(DESK);

    at(5);
    pc.engine.dispatch(seatFocus());
    await pc.client.syncNow();
    await phone.client.syncNow();
    expect(desk(phone.engine.get()).auxiliary.counter.current).toBe(1);
    expect(phone.engine.get()).toEqual(pc.engine.get());
    expect(store.since(0)).toHaveLength(3);
  });

  it("voids the later of two conflicting offline actions on every device", async () => {
    const pc = makeDevice("pc");
    await pc.client.connect(url, TOKEN);
    const phone = makeDevice("phone");
    await phone.client.connect(url, TOKEN);
    pc.engine.dispatch(seatFocus());
    await pc.client.syncNow();
    await phone.client.syncNow();

    at(10);
    phone.engine.dispatch({ type: "abandonUnit" }); // offline: not synced yet
    at(65);
    pc.engine.dispatch({ type: "finishUnit", keep: true });
    await pc.client.syncNow();
    expect(desk(pc.engine.get()).main.counters[0].current).toBe(1);

    await phone.client.syncNow();
    await pc.client.syncNow();
    for (const d of [pc, phone]) {
      expect(desk(d.engine.get()).main.counters[0].current).toBe(0);
      expect(d.engine.voided().map((e) => e.action.type)).toEqual(["finishUnit"]);
    }
  });

  it("asks before replacing different local data, and keeps a backup", async () => {
    const pc = makeDevice("pc");
    pc.engine.dispatch({ type: "saveCategory", categoryId: null, name: "Reading" });
    await pc.client.connect(url, TOKEN);

    const otherBase = { version: 3 as const, base: { ...defaultState(), chains: [] }, log: [] };
    const refuse = makeDevice("laptop", otherBase, false);
    expect((await refuse.client.connect(url, TOKEN)).ok).toBe(false);
    expect(refuse.engine.get().chains).toEqual([]);
    expect(refuse.device.sync).toBeNull();

    const accept = makeDevice("laptop2", otherBase, true);
    expect((await accept.client.connect(url, TOKEN)).ok).toBe(true);
    expect(accept.backups).toHaveLength(1);
    expect(accept.engine.get().categories.map((c) => c.name)).toContain("Reading");
  });

  it("rejects a wrong token without changing anything", async () => {
    const pc = makeDevice("pc");
    const r = await pc.client.connect(url, "wrong-token-000000");
    expect(r).toEqual({ ok: false, message: "Wrong token" });
    expect(store.base()).toBeNull();
  });
});

describe("server API", () => {
  const call = (path: string, init: RequestInit = {}, token = TOKEN) =>
    fetch(`${url}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" } });

  it("guards every route but health", async () => {
    expect((await fetch(`${url}/api/health`)).status).toBe(200);
    expect((await call("/api/data", {}, "nope")).status).toBe(401);
    expect((await call("/nowhere")).status).toBe(404);
  });

  it("seeds once and refuses syncing before that", async () => {
    const sync = { method: "POST", body: JSON.stringify({ device: "pc", since: 0, entries: [] }) };
    expect((await call("/api/sync", sync)).status).toBe(409);
    const seed = { method: "POST", body: JSON.stringify({ base: defaultState(), entries: [] }) };
    expect((await call("/api/seed", seed)).status).toBe(200);
    expect((await call("/api/seed", seed)).status).toBe(409);
    expect((await call("/api/seed", { method: "POST", body: "{bad" })).status).toBe(400);
    const bad = { method: "POST", body: JSON.stringify({ device: "pc", since: 0, entries: [{ id: "x" }] }) };
    expect((await call("/api/sync", bad)).status).toBe(400);
  });

  it("stores push subscriptions", async () => {
    const sub = { endpoint: "https://push.example/abc", keys: { p256dh: "k", auth: "a" } };
    expect((await call("/api/push/subscribe", { method: "POST", body: JSON.stringify({ device: "phone", subscription: sub }) })).status).toBe(200);
    expect(store.subscriptions()).toEqual([sub]);
    await call("/api/push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint: sub.endpoint }) });
    expect(store.subscriptions()).toEqual([]);
  });

  it("schedules reminders for a reservation it learns about", async () => {
    const pc = makeDevice("pc");
    await pc.client.connect(url, TOKEN);
    pc.engine.dispatch({ type: "reserve", chainId: DESK });
    await pc.client.syncNow();
    expect(app.reminders.pending().sort()).toEqual([`missed-${T0}`, `warn-${T0}`]);
  });
});

describe("reminders", () => {
  it("covers the reservation deadline and the seat minimum", () => {
    const state = { ...defaultState(), reservation: { chainId: DESK, reservedAt: T0, deadline: T0 + 15 * MIN, expired: false } };
    expect(remindersFor(state).map((r) => [r.key, r.at])).toEqual([
      [`warn-${T0}`, T0 + 13 * MIN],
      [`missed-${T0}`, T0 + 15 * MIN],
    ]);
  });

  it("sends each reminder once and drops ones that no longer apply", () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const sent: string[] = [];
    const s = new ReminderScheduler((r) => sent.push(r.key));
    const reserved = { ...defaultState(), reservation: { chainId: DESK, reservedAt: T0, deadline: T0 + 15 * MIN, expired: false } };
    s.schedule(reserved);
    vi.advanceTimersByTime(13 * MIN);
    s.schedule(reserved);
    expect(sent).toEqual([`warn-${T0}`]);
    s.schedule(defaultState()); // seated in time: reservation gone
    vi.advanceTimersByTime(5 * MIN);
    expect(sent).toEqual([`warn-${T0}`]);
    s.stop();
  });
});
