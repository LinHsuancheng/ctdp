import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { reduce, type Action, type CtdpState, type DomainEvent } from "../shared/ctdp";

interface EngineEvents {
  /** The state changed (already persisted). */
  state: [CtdpState];
  event: [DomainEvent, CtdpState];
  /** Fires every second, changed or not. */
  tick: [CtdpState, number];
}

/** Owns the state in the main process so timers keep running with all windows closed. */
export class Engine extends EventEmitter<EngineEvents> {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private state: CtdpState,
    private readonly persist: (state: CtdpState) => void,
  ) {
    super();
  }

  get(): CtdpState {
    return this.state;
  }

  dispatch(action: Action): DomainEvent[] {
    const { state, events } = reduce(this.state, action, { now: Date.now(), id: randomUUID });
    if (state !== this.state) {
      this.state = state;
      this.persist(state);
      this.emit("state", state);
    }
    for (const event of events) this.emit("event", event, state);
    return events;
  }

  /** Swaps in a whole state, e.g. from an import. */
  replace(state: CtdpState): void {
    this.state = state;
    this.persist(state);
    this.emit("state", state);
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
