import { BrowserWindow, ipcMain } from "electron";
import { isAction } from "../shared/ctdp";
import { IPC } from "../shared/ipc";
import type { Engine } from "./engine";

export function registerIpc(engine: Engine, handlers: { openMain(): void; hideMini(): void }): void {
  ipcMain.handle(IPC.getState, () => engine.get());
  ipcMain.handle(IPC.dispatch, (_e, action: unknown) => {
    if (!isAction(action)) throw new Error("invalid action");
    engine.dispatch(action);
  });
  ipcMain.on(IPC.openMain, () => handlers.openMain());
  ipcMain.on(IPC.hideMini, () => handlers.hideMini());

  engine.on("state", (state) => {
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send(IPC.state, state);
  });
}
