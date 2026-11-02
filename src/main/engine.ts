import { EventEmitter } from "node:events";
import {
  applyEntry,
  entryId,
  mergeLogs,
  replay,
  sanitizeDeviceSettings,
  tickAt,
  type Action,
  type CtdpData,
  type CtdpState,
  type DeviceSettings,
  type DomainEvent,
  type LogEntry,
  type Result,
} from "../shared/ctdp";
import type { Device } from "./store";

interface EngineEvents {
  /** The shared state changed. */
  state: [CtdpState];
  device: [DeviceSettings];
  event: [DomainEvent, CtdpState];
  /** Fires every second, changed or not. */
  tick: [CtdpState, number];
  /** A local action was added to the log. */
  appended: [LogEntry];
  /** Entries overruled when logs were merged. */
  voided: [LogEntry[]];
}

export interface Persist {
  data(data: CtdpData): void;
  device(device: Device): void;
}

/**
 * Owns the state in the main process so timers keep running with all windows
 * closed. Every effective action is appended to the log; the state is always
 * the replay of that log.
 */
export class Engine extends EventEmitter<EngineEvents> {
  private timer: NodeJS.Timeout | null = null;
  private state: CtdpState;
  private overruled: LogEntry[];

  constructor(
    private data: CtdpData,
    private readonly device: Device,
    private readonly persist: Persist,
  ) {
    super();
    const replayed = replay(data.base, data.log);
    this.state = replayed.state;
    this.overruled = replayed.voided;
    // Never reuse a sequence number, even if the device file fell behind.
    const own = data.log.filter((e) => e.device === device.id).map((e) => e.seq);
    device.seq = Math.max(device.seq, ...own);
  }

  get(): CtdpState {
    return this.state;
  }

  getData(): CtdpData {
    return this.data;
  }

  deviceId(): string {
    return this.device.id;
  }

  voided(): LogEntry[] {
    return this.overruled;
  }

  settings(): DeviceSettings {
    return this.device.settings;
  }

  dispatch(action: Action): DomainEvent[] {
    const now = Date.now();
    if (action.type === "tick") return this.apply(tickAt(this.state, now));
    const seq = this.device.seq + 1;
    const entry = { id: entryId(this.device.id, seq), device: this.device.id, seq, at: now, action };
    const r = applyEntry(this.state, entry);
    if (r.effective) {
      this.device.seq = seq;
      this.data = { ...this.data, log: [...this.data.log, entry] };
      this.persist.device(this.device);
      this.persist.data(this.data);
    }
    const events = this.apply(r);
    if (r.effective) this.emit("appended", entry);
    return events;
  }

  /** Swaps in a whole data set, e.g. from an import or another device. */
  replace(data: CtdpData): void {
    this.data = data;
    this.persist.data(data);
    this.recompute();
  }

  /** Adds entries from other devices and replays. Returns whether anything was new. */
  merge(entries: LogEntry[]): boolean {
    const log = mergeLogs(this.data.log, entries);
    if (log.length === this.data.log.length) return false;
    this.data = { ...this.data, log };
    this.persist.data(this.data);
    this.recompute();
    return true;
  }

  /**
   * Replays the whole log. Time catches up silently: the events of a
   * replay were already announced, or happened on another device.
   */
  private recompute(): void {
    const { state, voided } = replay(this.data.base, this.data.log);
    this.state = tickAt(state, Date.now()).state;
    this.emit("state", this.state);
    if (voided.length !== this.overruled.length) {
      this.overruled = voided;
      this.emit("voided", voided);
    }
  }

  updateSettings(patch: Partial<DeviceSettings>): void {
    this.device.settings = sanitizeDeviceSettings({ ...this.device.settings, ...patch });
    this.persist.device(this.device);
    this.emit("device", this.device.settings);
  }

  private apply({ state, events }: Result): DomainEvent[] {
    if (state !== this.state) {
      this.state = state;
      this.emit("state", state);
    }
    for (const event of events) this.emit("event", event, state);
    return events;
  }

  start(): void {
    const tick = () => {
      this.dispatch({ type: "tick" });
      this.emit("tick", this.state, Date.now());
    };
    tick();
    this.timer = setInterval(tick, 1000);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
