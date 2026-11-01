import type { BrowserWindow } from "electron";
import type { CtdpState, Phase } from "../shared/ctdp";

const phaseKey = (p: Phase) =>
  p.kind === "reserved" ? `r${p.reservedAt}` : p.kind === "focusing" ? `f${p.startedAt}` : "idle";

/** Shows the mini window for each reservation/session unless the user dismissed that one. */
export class MiniController {
  private dismissed: string | null = null;
  private current = "idle";

  constructor(private readonly win: BrowserWindow) {}

  sync(state: CtdpState): void {
    this.current = phaseKey(state.phase);
    const want = state.settings.showMiniWindow && state.phase.kind !== "idle" && this.dismissed !== this.current;
    if (want && !this.win.isVisible()) this.win.showInactive();
    else if (!want && this.win.isVisible()) this.win.hide();
  }

  dismiss(): void {
    this.dismissed = this.current;
    this.win.hide();
  }
}
