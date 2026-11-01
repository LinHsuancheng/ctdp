import type { BrowserWindow } from "electron";
import type { CtdpState } from "../shared/ctdp";

const activityKey = (s: CtdpState) =>
  s.seat ? `s${s.seat.node.id}` : s.reservation ? `r${s.reservation.reservedAt}` : "idle";

/** Shows the mini window while seated or reserved, unless the user dismissed that one. */
export class MiniController {
  private dismissed: string | null = null;
  private current = "idle";

  constructor(private readonly win: BrowserWindow) {}

  sync(state: CtdpState): void {
    this.current = activityKey(state);
    const want = state.settings.showMiniWindow && this.current !== "idle" && this.dismissed !== this.current;
    if (want && !this.win.isVisible()) this.win.showInactive();
    else if (!want && this.win.isVisible()) this.win.hide();
  }

  dismiss(): void {
    this.dismissed = this.current;
    this.win.hide();
  }
}
