import { chainOf, formatClock, MINUTE, type CtdpState } from "../../src/shared/ctdp";

export interface Reminder {
  /** Stable per occurrence, so a reminder is sent at most once. */
  key: string;
  at: number;
  title: string;
  body: string;
}

const WARN_BEFORE = 2 * MINUTE;

/** Time-based reminders the shared state implies, the same ones the desktop shows. */
export function remindersFor(state: CtdpState): Reminder[] {
  const out: Reminder[] = [];
  const r = state.reservation;
  if (r && !r.expired) {
    const name = chainOf(state, r.chainId)?.name ?? "Chain";
    out.push({ key: `warn-${r.reservedAt}`, at: r.deadline - WARN_BEFORE, title: "Almost time", body: `${name}: sit down by ${formatClock(r.deadline)}.` });
    out.push({
      key: `missed-${r.reservedAt}`,
      at: r.deadline,
      title: "Reservation missed",
      body: `${name}: judge it — break the auxiliary track, or allow this situation forever.`,
    });
  }
  const seat = state.seat;
  if (seat && !seat.minReached) {
    const name = chainOf(state, seat.chainId)?.name ?? "Chain";
    out.push({
      key: `min-${seat.node.id}`,
      at: seat.node.startedAt + seat.node.spec.minMinutes * MINUTE,
      title: "Minimum reached",
      body: `${name}: you may finish and keep this node whenever you are ready.`,
    });
  }
  return out;
}

/** Keeps one timer per pending reminder; reschedule whenever the state changes. */
export class ReminderScheduler {
  private timers = new Map<string, NodeJS.Timeout>();
  private sent = new Set<string>();

  constructor(
    private readonly send: (reminder: Reminder) => void,
    private readonly now: () => number = () => Date.now(),
  ) {}

  schedule(state: CtdpState): void {
    const wanted = remindersFor(state).filter((r) => !this.sent.has(r.key) && r.at >= this.now() - MINUTE);
    const keys = new Set(wanted.map((r) => r.key));
    for (const [key, timer] of this.timers) {
      if (!keys.has(key)) {
        clearTimeout(timer);
        this.timers.delete(key);
      }
    }
    for (const r of wanted) {
      if (this.timers.has(r.key)) continue;
      const timer = setTimeout(() => {
        this.timers.delete(r.key);
        this.sent.add(r.key);
        this.send(r);
      }, Math.max(0, r.at - this.now()));
      this.timers.set(r.key, timer);
    }
  }

  pending(): string[] {
    return [...this.timers.keys()];
  }

  stop(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}
