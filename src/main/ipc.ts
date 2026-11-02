import { BrowserWindow, ipcMain } from "electron";
import { isAction } from "../shared/ctdp";
import { IPC, type Intent, type ShortcutStatus } from "../shared/ipc";
import type { Engine } from "../shared/runtime";

const INTENTS: readonly Intent[] = ["action", "sign", "leave"];

export interface WindowHandlers {
  openMain(intent: Intent | null): void;
  hideMain(): void;
  hideMini(): void;
  shortcutStatus(): ShortcutStatus;
  testShortcut(accelerator: string): ShortcutStatus;
}

export function registerIpc(engine: Engine, handlers: WindowHandlers): void {
  ipcMain.handle(IPC.getState, () => engine.get());
  ipcMain.handle(IPC.dispatch, (_e, action: unknown) => {
    if (!isAction(action)) throw new Error("invalid action");
    engine.dispatch(action);
  });
  ipcMain.handle(IPC.getSettings, () => engine.settings());
  ipcMain.handle(IPC.updateSettings, (_e, patch: unknown) => {
    if (typeof patch !== "object" || patch === null) throw new Error("invalid settings");
    engine.updateSettings(patch);
  });
  ipcMain.on(IPC.openMain, (_e, intent: unknown) => handlers.openMain(INTENTS.includes(intent as Intent) ? (intent as Intent) : null));
  ipcMain.on(IPC.hideMain, () => handlers.hideMain());
  ipcMain.on(IPC.hideMini, () => handlers.hideMini());
  ipcMain.handle(IPC.shortcutStatus, () => handlers.shortcutStatus());
  ipcMain.handle(IPC.testShortcut, (_e, accelerator: unknown) => {
    if (typeof accelerator !== "string" || !accelerator.trim()) throw new Error("invalid shortcut");
    return handlers.testShortcut(accelerator.trim());
  });

  engine.on("state", (state) => {
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send(IPC.state, state);
  });
  engine.on("device", (settings) => {
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send(IPC.settings, settings);
  });
}
