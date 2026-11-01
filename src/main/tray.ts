import { Menu, Tray, nativeImage } from "electron";
import { phaseLabel, type CtdpState } from "../shared/ctdp";
import type { Engine } from "./engine";
import { trayIconPath } from "./paths";

interface TrayActions {
  showMain(): void;
  quickStart(): void;
  quit(): void;
}

export class TrayController {
  private readonly tray: Tray;

  constructor(
    private readonly engine: Engine,
    private readonly actions: TrayActions,
  ) {
    this.tray = new Tray(nativeImage.createFromPath(trayIconPath()));
    this.tray.on("click", () => actions.showMain());
    this.update(engine.get());
  }

  update(state: CtdpState): void {
    const status = `${phaseLabel(state)} · 主链 #${state.mainChain} · 预约链 #${state.reserveChain}`;
    const { phase, settings } = state;
    this.tray.setToolTip(`CTDP\n${status}`);
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: status, enabled: false },
        { type: "separator" },
        {
          label: `预约（${settings.reserveWindowMin} 分钟内落座）`,
          enabled: phase.kind === "idle",
          click: () => this.engine.dispatch({ type: "reserve" }),
        },
        {
          label: `落座开始（${settings.defaultSessionMin} 分钟）`,
          enabled: phase.kind !== "focusing",
          click: () => this.actions.quickStart(),
        },
        { type: "separator" },
        { label: "打开主窗口", click: () => this.actions.showMain() },
        { label: "退出", click: () => this.actions.quit() },
      ]),
    );
  }

  destroy(): void {
    this.tray.destroy();
  }
}
