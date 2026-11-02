import { BrowserWindow, ipcMain } from "electron";
import { isAction } from "../shared/ctdp";
import { IPC } from "../shared/ipc";
import type { Engine } from "../shared/runtime";

export function registerIpc(engine: Engine, handlers: { openMain(): void; hideMini(): void }): void {
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
  ipcMain.on(IPC.openMain, () => handlers.openMain());
  ipcMain.on(IPC.hideMini, () => handlers.hideMini());

  engine.on("state", (state) => {
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send(IPC.state, state);
  });
  engine.on("device", (settings) => {
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send(IPC.settings, settings);
  });
}
