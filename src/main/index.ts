import { app, BrowserWindow } from "electron";
import { registerDataIpc } from "./data";
import { Engine } from "./engine";
import { registerIpc } from "./ipc";
import { MiniController } from "./mini";
import { Notifier } from "./notifier";
import { Shortcuts } from "./shortcuts";
import { isSmoke, prepareSmoke, runSmoke } from "./smoke";
import { loadState, saveState } from "./store";
import { TrayController } from "./tray";
import { createMainWindow, createMiniWindow } from "./windows";

const smoke = isSmoke();
if (smoke) prepareSmoke();

if (!smoke && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  boot();
}

function boot(): void {
  let quitting = false;
  let mainWin: BrowserWindow | null = null;

  app.setAppUserModelId("com.ctdp.desktop");
  app.on("before-quit", () => {
    quitting = true;
  });
  // Keep running in the tray when every window is closed.
  app.on("window-all-closed", () => {});

  app.whenReady().then(() => {
    const engine = new Engine(loadState(), saveState);

    const openMain = (): BrowserWindow => {
      if (mainWin && !mainWin.isDestroyed()) {
        if (mainWin.isMinimized()) mainWin.restore();
        mainWin.show();
        mainWin.focus();
        return mainWin;
      }
      const win = createMainWindow();
      win.on("close", (e) => {
        if (!quitting) {
          e.preventDefault();
          win.hide();
        }
      });
      mainWin = win;
      return win;
    };
    // Both shortcuts act on the primary chain; without one, open the window to pick.
    const withPrimary = (fn: (chainId: string) => void) => () => {
      const id = engine.get().primaryChainId;
      if (id && !engine.get().successionPending) fn(id);
      else openMain();
    };
    const reserve = withPrimary((chainId) => engine.dispatch({ type: "reserve", chainId }));
    const quickStart = withPrimary((chainId) =>
      engine.dispatch({
        type: "seat",
        chainId,
        chunkId: engine.get().settings.quickStartChunkId,
        task: "",
        minutes: 60,
        categoryId: null,
      }),
    );

    const miniWin = createMiniWindow();
    const mini = new MiniController(miniWin);
    const notifier = new Notifier();
    const tray = new TrayController(engine.get(), { showMain: openMain, reserve, quickStart, quit: () => app.quit() });
    const shortcuts = new Shortcuts({ reserve, start: quickStart });

    registerIpc(engine, { openMain, hideMini: () => mini.dismiss() });
    registerDataIpc(engine);
    engine.on("state", (state) => {
      tray.update(state);
      mini.sync(state);
      shortcuts.apply(state.settings);
    });
    engine.on("event", (event, state) => notifier.onEvent(event, state));
    engine.on("tick", (state, now) => notifier.onTick(state, now));

    shortcuts.apply(engine.get().settings);
    mini.sync(engine.get());
    engine.start();
    const win = openMain();

    app.on("second-instance", () => openMain());
    app.on("will-quit", () => {
      engine.stop();
      shortcuts.dispose();
      tray.destroy();
    });

    if (smoke) void runSmoke(win, miniWin, engine);
  });
}
