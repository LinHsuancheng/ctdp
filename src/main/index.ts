import { app, BrowserWindow } from "electron";
import { registerDataIpc } from "./data";
import { Engine } from "../shared/runtime";
import { registerIpc } from "./ipc";
import { MiniController } from "./mini";
import { Notifier } from "./notifier";
import { Shortcuts } from "./shortcuts";
import { isSmoke, prepareSmoke, runSmoke } from "./smoke";
import { loadData, loadDevice, saveData, saveDevice } from "./store";
import { setupSync } from "./syncIpc";
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
    const { data, legacySettings } = loadData();
    const device = loadDevice(legacySettings);
    const engine = new Engine(data, device, { data: (d) => saveData(d), device: saveDevice });

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
    // Fall back to an ad-hoc unit if the chosen chunk was deleted (possibly on another device).
    const quickStartChunk = () => {
      const id = engine.settings().quickStartChunkId;
      return engine.get().chunks.some((c) => c.id === id) ? id : null;
    };
    const reserve = withPrimary((chainId) => engine.dispatch({ type: "reserve", chainId }));
    const quickStart = withPrimary((chainId) =>
      engine.dispatch({
        type: "seat",
        chainId,
        chunkId: quickStartChunk(),
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
    const sync = setupSync(engine, device);
    engine.on("state", (state) => {
      tray.update(state);
      mini.sync(state, engine.settings());
    });
    engine.on("device", (settings) => {
      mini.sync(engine.get(), settings);
      shortcuts.apply(settings);
    });
    engine.on("event", (event, state) => engine.settings().notifications && notifier.onEvent(event, state));
    engine.on("tick", (state, now) => engine.settings().notifications && notifier.onTick(state, now));

    shortcuts.apply(engine.settings());
    mini.sync(engine.get(), engine.settings());
    engine.start();
    const win = openMain();

    app.on("second-instance", () => openMain());
    app.on("will-quit", () => {
      engine.stop();
      sync.stop();
      shortcuts.dispose();
      tray.destroy();
    });

    if (smoke) void runSmoke(win, miniWin, engine, sync);
  });
}
