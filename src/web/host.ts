import { emptyData, parseData, type CtdpData, type CtdpState, type DeviceSettings } from "../shared/ctdp";
import type { CtdpApi, DataResult, SyncView } from "../shared/ipc";
import { ackVoided, buildSyncView, Engine, newDevice, parseDevice, SyncClient } from "../shared/runtime";
import { KeyValueStore } from "./idb";
import { createPush } from "./push";

type Listeners<T> = Set<(value: T) => void>;
const subscribe = <T>(set: Listeners<T>, listener: (value: T) => void) => {
  set.add(listener);
  return () => void set.delete(listener);
};
const today = () => new Date().toISOString().slice(0, 10);

/** Asks for a JSON file; resolves null if the user cancels. */
function pickFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/**
 * The phone's stand-in for Electron's main process: the same engine and sync
 * client, run in the page, with data kept in IndexedDB. The phone shares
 * notifications through the server, so it never shows local ones.
 */
export async function createWebHost(): Promise<CtdpApi> {
  const kv = await KeyValueStore.open();
  void navigator.storage?.persist?.();
  const data = parseData(await kv.get("data")) ?? emptyData();
  const device = parseDevice(await kv.get("device")) ?? newDevice(crypto.randomUUID().slice(0, 8), { notifications: false });
  const saveDevice = () => void kv.put("device", device);
  saveDevice();

  const engine = new Engine(data, device, { data: (d) => void kv.put("data", d), device: saveDevice });
  const backup = async (d: CtdpData) => {
    const key = `backup-${Date.now()}`;
    await kv.put(key, d);
    return `this phone's browser storage (${key})`;
  };
  const client = new SyncClient({
    engine,
    device,
    saveDevice,
    backup,
    // A phone that has not been used yet simply takes the server's data.
    confirmReplace: async () =>
      engine.getData().log.length === 0 ||
      confirm("The server already has data from another device. Replace this phone's data with it? A backup is kept in this browser."),
  });

  const call = async <T>(path: string, body?: unknown): Promise<T> => {
    const sync = device.sync;
    if (!sync) throw new Error("Connect to the sync server first.");
    const res = await fetch(`${sync.url}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { authorization: `Bearer ${sync.token}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) throw new Error(json.error ?? `Server error ${res.status}`);
    return json;
  };
  const push = createPush(call, () => device.id, (on) => engine.updateSettings({ notifications: on }));

  const stateListeners: Listeners<CtdpState> = new Set();
  const settingsListeners: Listeners<DeviceSettings> = new Set();
  const syncListeners: Listeners<SyncView> = new Set();
  const view = () => buildSyncView(engine, device, client);
  const broadcastSync = () => syncListeners.forEach((l) => l(view()));
  engine.on("state", (s) => stateListeners.forEach((l) => l(s)));
  engine.on("device", (s) => settingsListeners.forEach((l) => l(s)));
  engine.on("voided", broadcastSync);
  client.on("status", broadcastSync);

  engine.start();
  client.start();
  // Phones freeze background pages; catch up as soon as the app is back.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    engine.dispatch({ type: "tick" });
    void client.syncNow();
  });
  addEventListener("online", () => void client.syncNow());

  const api: CtdpApi = {
    platform: "web",
    push,
    getState: async () => engine.get(),
    dispatch: async (action) => void engine.dispatch(action),
    onState: (l) => subscribe(stateListeners, l),
    getSettings: async () => engine.settings(),
    updateSettings: async (patch) => engine.updateSettings(patch),
    onSettings: (l) => subscribe(settingsListeners, l),
    openMain: () => {},
    hideMini: () => {},
    dataFile: async () => "In this browser on this phone",
    revealData: () => {},
    exportData: async (): Promise<DataResult> => {
      const name = `ctdp-export-${today()}.json`;
      const url = URL.createObjectURL(new Blob([JSON.stringify(engine.getData(), null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return { ok: true, path: name, message: `Exported as ${name}` };
    },
    importData: async (): Promise<DataResult> => {
      const file = await pickFile();
      if (!file) return { ok: false, path: null, message: "" };
      let imported: CtdpData | null = null;
      try {
        imported = parseData(JSON.parse(await file.text()));
      } catch {
        imported = null;
      }
      if (!imported) return { ok: false, path: file.name, message: `${file.name} is not CTDP data; nothing was changed.` };
      if (!confirm("Replace all current data with the imported file? A backup is kept in this browser.")) return { ok: false, path: null, message: "" };
      const where = await backup(engine.getData());
      engine.replace(imported);
      return { ok: true, path: file.name, message: `Imported. The previous data was saved to ${where}` };
    },
    getSync: async () => view(),
    onSync: (l) => subscribe(syncListeners, l),
    syncConnect: (url, token) => client.connect(url, token),
    syncDisconnect: async () => {
      await push.disable();
      client.disconnect();
    },
    syncNow: () => client.syncNow(),
    ackVoided: async () => {
      ackVoided(engine, device);
      saveDevice();
      broadcastSync();
    },
  };
  return api;
}
