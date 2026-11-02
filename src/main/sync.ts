import { EventEmitter } from "node:events";
import type { CtdpData, DataResponse, LogEntry, SyncResponse } from "../shared/ctdp";
import type { SyncStatus } from "../shared/ipc";
import type { Engine } from "./engine";
import type { Device } from "./store";

export interface SyncDeps {
  engine: Engine;
  device: Device;
  saveDevice(device: Device): void;
  /** Asks before this device's data is replaced by the server's. */
  confirmReplace(): Promise<boolean>;
  /** Keeps a copy of local data before it is replaced; returns where. */
  backup(data: CtdpData): string;
  fetch?: typeof fetch;
  intervalMs?: number;
}

class SyncError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}

const SYNC_DELAY_MS = 300;
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Keeps this device's log in step with the sync server. No Electron here, so tests can drive it. */
export class SyncClient extends EventEmitter<{ status: [SyncStatus] }> {
  private timer: NodeJS.Timeout | null = null;
  private soon: NodeJS.Timeout | null = null;
  private running: Promise<void> | null = null;
  private queued: Promise<void> | null = null;
  private current: SyncStatus;
  private readonly fetch: typeof fetch;

  constructor(private readonly deps: SyncDeps) {
    super();
    this.fetch = deps.fetch ?? fetch;
    this.current = { url: deps.device.sync?.url ?? null, state: deps.device.sync ? "idle" : "off", lastSync: null, error: null };
    deps.engine.on("appended", () => this.scheduleSoon());
  }

  status(): SyncStatus {
    return this.current;
  }

  private setStatus(patch: Partial<SyncStatus>): void {
    this.current = { ...this.current, ...patch };
    this.emit("status", this.current);
  }

  private async call<T>(url: string, token: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await this.fetch(`${url}${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      throw new SyncError(`Cannot reach the server (${(err as Error).message})`);
    }
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (res.status === 401) throw new SyncError("Wrong token", 401);
    if (!res.ok) throw new SyncError(json.error ?? `Server error ${res.status}`, res.status);
    return json as T;
  }

  /** Connects to a server: seeds an empty one, or joins one that has data. */
  async connect(rawUrl: string, token: string): Promise<{ ok: boolean; message: string }> {
    const url = rawUrl.trim().replace(/\/+$/, "");
    if (!/^https?:\/\/[^/]+/.test(url)) return { ok: false, message: "Enter the server address, e.g. https://ctdp.example.org" };
    if (!token.trim()) return { ok: false, message: "Enter the token" };
    const { engine, device } = this.deps;
    try {
      const remote = await this.call<DataResponse>(url, token, "/api/data");
      const local = engine.getData();
      const own = (log: LogEntry[]) => Math.max(0, ...log.filter((e) => e.device === device.id).map((e) => e.seq));
      let message: string;
      if (!remote.base) {
        const seeded = await this.call<{ cursor: number }>(url, token, "/api/seed", { base: local.base, entries: local.log });
        device.sync = { url, token, cursor: seeded.cursor, ackSeq: own(local.log) };
        message = "Connected. This device's data is now on the server.";
      } else if (sameJson(remote.base, local.base)) {
        // Same history (e.g. reconnecting): just exchange what is missing.
        device.sync = { url, token, cursor: 0, ackSeq: 0 };
        message = "Connected.";
      } else {
        if (!(await this.deps.confirmReplace())) return { ok: false, message: "Cancelled; nothing was changed." };
        const backup = this.deps.backup(local);
        engine.replace({ version: 3, base: remote.base, log: remote.entries });
        device.sync = { url, token, cursor: remote.cursor, ackSeq: own(remote.entries) };
        message = `Connected. This device now uses the server's data; the previous data was saved to ${backup}`;
      }
      this.deps.saveDevice(device);
      this.setStatus({ url, state: "idle", error: null });
      this.start();
      await this.syncNow();
      return { ok: true, message };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }

  disconnect(): void {
    this.stop();
    this.deps.device.sync = null;
    this.deps.saveDevice(this.deps.device);
    this.setStatus({ url: null, state: "off", error: null });
  }

  /**
   * Sends unsent own entries and merges everything new. Resolves after a run
   * that started after this call; calls made meanwhile share that run.
   */
  syncNow(): Promise<void> {
    this.queued ??= (this.running ?? Promise.resolve()).then(() => {
      this.queued = null;
      this.running = this.runOnce().finally(() => {
        this.running = null;
      });
      return this.running;
    });
    return this.queued;
  }

  private async runOnce(): Promise<void> {
    const { engine, device } = this.deps;
    const sync = device.sync;
    if (!sync) return;
    this.setStatus({ state: "syncing" });
    try {
      const entries = engine.getData().log.filter((e) => e.device === device.id && e.seq > sync.ackSeq);
      const res = await this.call<SyncResponse>(sync.url, sync.token, "/api/sync", { device: device.id, since: sync.cursor, entries });
      engine.merge(res.entries);
      if (device.sync === sync) {
        device.sync = { ...sync, cursor: res.cursor, ackSeq: res.ackSeq };
        this.deps.saveDevice(device);
      }
      this.setStatus({ state: "ok", lastSync: Date.now(), error: null });
    } catch (err) {
      const message = err instanceof SyncError && err.status === 409 ? "The server has no data any more; connect again." : (err as Error).message;
      this.setStatus({ state: "error", error: message });
    }
  }

  private scheduleSoon(): void {
    if (!this.deps.device.sync || this.soon) return;
    this.soon = setTimeout(() => {
      this.soon = null;
      void this.syncNow();
    }, SYNC_DELAY_MS);
  }

  start(): void {
    if (!this.deps.device.sync || this.timer) return;
    this.timer = setInterval(() => void this.syncNow(), this.deps.intervalMs ?? 10_000);
    void this.syncNow();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.soon) clearTimeout(this.soon);
    this.timer = this.soon = null;
  }
}
