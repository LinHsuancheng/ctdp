import { BrowserWindow, dialog, ipcMain } from "electron";
import { IPC } from "../shared/ipc";
import { ackVoided, buildSyncView, SyncClient, type Device, type Engine } from "../shared/runtime";
import { backupData, saveDevice } from "./store";

/** Wires the sync client to Electron: confirmation dialog, IPC, and the renderer view. */
export function setupSync(engine: Engine, device: Device): SyncClient {
  const client = new SyncClient({
    engine,
    device,
    saveDevice,
    backup: backupData,
    confirmReplace: async () => {
      const opts = {
        type: "warning" as const,
        buttons: ["Use the server's data", "Cancel"],
        defaultId: 1,
        cancelId: 1,
        message: "The server already has data from another device.",
        detail: "This device's chains, chunks, precedents and history will be replaced by the server's. A backup of the current data is kept next to the data file.",
      };
      const win = BrowserWindow.getFocusedWindow();
      const { response } = win ? await dialog.showMessageBox(win, opts) : await dialog.showMessageBox(opts);
      return response === 0;
    },
  });

  const view = () => buildSyncView(engine, device, client);
  const broadcast = () => {
    const v = view();
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send(IPC.sync, v);
  };
  client.on("status", broadcast);
  engine.on("voided", broadcast);

  ipcMain.handle(IPC.getSync, () => view());
  ipcMain.handle(IPC.syncConnect, (_e, url: unknown, token: unknown) => {
    if (typeof url !== "string" || typeof token !== "string") throw new Error("invalid arguments");
    return client.connect(url, token);
  });
  ipcMain.handle(IPC.syncDisconnect, () => client.disconnect());
  ipcMain.handle(IPC.syncNow, () => client.syncNow());
  ipcMain.handle(IPC.ackVoided, () => {
    ackVoided(engine, device);
    saveDevice(device);
    broadcast();
  });

  client.start();
  return client;
}
