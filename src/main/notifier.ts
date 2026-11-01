import { Notification } from "electron";
import { chainOf, formatClock, levelMark, MINUTE, type CtdpState, type DomainEvent } from "../shared/ctdp";
import { iconPath } from "./paths";

const WARN_BEFORE = 2 * MINUTE;

export class Notifier {
  private warnedFor: number | null = null;

  onEvent(event: DomainEvent, state: CtdpState): void {
    const name = "chainId" in event ? (chainOf(state, event.chainId)?.name ?? "Chain") : "";
    switch (event.type) {
      case "reserved":
        return this.show("Reserved", `${name}: sit down by ${formatClock(event.deadline)}.`);
      case "reservationExpired":
        return this.show("Reservation missed", `${name}: judge it — break the auxiliary track, or allow this situation forever.`);
      case "auxKept":
        return this.show("Reservation kept", `${name}: auxiliary #${event.number}`);
      case "minReached":
        return this.show("Minimum reached", `${name}: you may finish and keep this node whenever you are ready.`);
      case "kept":
        return this.show("Node kept", `${name}: ${levelMark(event.level)}${event.number} · ${event.name}`);
      case "mainLost":
        return this.show("Chain lost", `${name}: ${event.reason}. Main #${event.length} is gone. Failure is data.`);
      case "successionNeeded":
        return this.show("Primary chain lost", "Choose any chain to become the new primary.");
    }
  }

  /** Warns once per reservation shortly before its deadline. */
  onTick(state: CtdpState, now: number): void {
    const r = state.reservation;
    if (!r || r.expired || this.warnedFor === r.reservedAt) return;
    if (r.deadline - now <= WARN_BEFORE) {
      this.warnedFor = r.reservedAt;
      this.show("Almost time", `Reservation ends at ${formatClock(r.deadline)}. Sit down now.`);
    }
  }

  private show(title: string, body: string): void {
    if (Notification.isSupported()) new Notification({ title, body, icon: iconPath() }).show();
  }
}
