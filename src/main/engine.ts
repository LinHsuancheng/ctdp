import { EventEmitter } from "node:events";
import {
  applyEntry,
  entryId,
  replay,
  sanitizeDeviceSettings,
  tickAt,
  type Action,
  type CtdpData,
  type CtdpState,
  type DeviceSettings,
  type DomainEvent,
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

  constructor(
    private data: CtdpData,
    private readonly device: Device,
    private readonly persist: Persist,
  ) {
    super();
    this.state = replay(data.base, data.log).state;
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
    return this.apply(r);
  }

  /** Swaps in a whole data set, e.g. from an import. */
  replace(data: CtdpData): void {
    this.data = data;
    this.persist.data(data);
    this.state = tickAt(replay(data.base, data.log).state, Date.now()).state;
    this.emit("state", this.state);
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
