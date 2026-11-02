import type { BrowserWindow } from "electron";
import type { CtdpState, DeviceSettings } from "../shared/ctdp";

/** What the mini window is showing; a new activity shows it again after a dismissal. */
export function activityKey(s: CtdpState): string {
  if (s.seat) return `s${s.seat.node.id}`;
  if (s.reservation) return `r${s.reservation.reservedAt}`;
  // Between the units of a chunk in progress: the next unit waits.
  const open = s.chains.find((c) => c.main.open);
  return open ? `o${open.id}:${open.main.counters[0].current}` : "idle";
}

/** Shows the mini window while reserved, seated, or between units, unless the user dismissed that one. */
export class MiniController {
  private dismissed: string | null = null;
  private current = "idle";

  constructor(private readonly win: BrowserWindow) {}

  sync(state: CtdpState, settings: DeviceSettings): void {
    this.current = activityKey(state);
    const want = settings.showMiniWindow && this.current !== "idle" && this.dismissed !== this.current;
    if (want && !this.win.isVisible()) this.win.showInactive();
    else if (!want && this.win.isVisible()) this.win.hide();
  }

  dismiss(): void {
    this.dismissed = this.current;
    this.win.hide();
  }
}
