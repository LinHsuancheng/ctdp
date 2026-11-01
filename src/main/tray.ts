import { Menu, Tray, nativeImage } from "electron";
import { primaryChain, type CtdpState } from "../shared/ctdp";
import { trayIconPath } from "./paths";

interface TrayActions {
  showMain(): void;
  reserve(): void;
  quickStart(): void;
  quit(): void;
}

function status(state: CtdpState): string {
  const chain = primaryChain(state);
  if (!chain) return state.successionPending ? "Primary chain lost — pick a new one" : "No primary chain";
  const activity = state.seat ? "Seated" : state.reservation ? "Reserved" : "Idle";
  return `${activity} · ${chain.name} #${chain.main.counters[0].current} · aux #${chain.auxiliary.counter.current}`;
}

export class TrayController {
  private readonly tray: Tray;

  constructor(
    state: CtdpState,
    private readonly actions: TrayActions,
  ) {
    this.tray = new Tray(nativeImage.createFromPath(trayIconPath()));
    this.tray.on("click", () => actions.showMain());
    this.update(state);
  }

  update(state: CtdpState): void {
    const line = status(state);
    const hasPrimary = Boolean(primaryChain(state));
    this.tray.setToolTip(`CTDP\n${line}`);
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: line, enabled: false },
        { type: "separator" },
        { label: "Reserve (primary chain)", enabled: hasPrimary && !state.reservation, click: this.actions.reserve },
        { label: "Sit down (primary chain)", enabled: hasPrimary && !state.seat, click: this.actions.quickStart },
        { type: "separator" },
        { label: "Open CTDP", click: this.actions.showMain },
        { label: "Quit", click: this.actions.quit },
      ]),
    );
  }

  destroy(): void {
    this.tray.destroy();
  }
}
