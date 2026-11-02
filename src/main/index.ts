import { app, BrowserWindow } from "electron";
import { registerDataIpc } from "./data";
import { Engine } from "../shared/runtime";
import { IPC, type Intent } from "../shared/ipc";
import { registerIpc } from "./ipc";
import { activityKey, MiniController } from "./mini";
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

    const sendIntent = (win: BrowserWindow, intent: Intent) => {
      if (win.webContents.isLoading()) win.webContents.once("did-finish-load", () => win.webContents.send(IPC.intent, intent));
      else win.webContents.send(IPC.intent, intent);
    };
    const openMain = (intent: Intent | null = null): BrowserWindow => {
      let win = mainWin && !mainWin.isDestroyed() ? mainWin : null;
      if (!win) {
        win = createMainWindow();
        win.on("close", (e) => {
          if (!quitting) {
            e.preventDefault();
            win!.hide();
          }
        });
        mainWin = win;
      } else {
        if (win.isMinimized()) win.restore();
        win.show();
        win.focus();
      }
      if (intent) sendIntent(win, intent);
      return win;
    };
    const hideMain = () => mainWin?.hide();
    // The shortcut toggles: bring the window up, or put it away if it is already in front.
    const summon = () => {
      if (mainWin && !mainWin.isDestroyed() && mainWin.isVisible() && mainWin.isFocused()) mainWin.hide();
      else openMain();
    };

    const miniWin = createMiniWindow();
    const mini = new MiniController(miniWin);
    const notifier = new Notifier();
    const tray = new TrayController(engine.get(), { showMain: () => openMain(), quit: () => app.quit() });
    const shortcuts = new Shortcuts(summon);

    registerIpc(engine, {
      openMain,
      hideMain,
      hideMini: () => mini.dismiss(),
      shortcutStatus: () => shortcuts.status(),
      testShortcut: (accelerator) => shortcuts.test(accelerator),
    });
    registerDataIpc(engine);
    const sync = setupSync(engine, device);

    // Once a reservation or a sitting starts, the main window steps aside for the mini window.
    let activity = activityKey(engine.get());
    engine.on("state", (state) => {
      tray.update(state);
      mini.sync(state, engine.settings());
      const next = activityKey(state);
      const started = next !== activity && (state.seat !== null || (state.reservation !== null && !state.reservation.expired));
      activity = next;
      if (started && engine.settings().showMiniWindow && !smoke) hideMain();
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
