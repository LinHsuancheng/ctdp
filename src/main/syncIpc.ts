import { BrowserWindow, dialog, ipcMain } from "electron";
import { voidedOf } from "../shared/ctdp";
import { IPC, type SyncView } from "../shared/ipc";
import type { Engine } from "./engine";
import { backupData, saveDevice, type Device } from "./store";
import { SyncClient } from "./sync";

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

  const view = (): SyncView => {
    const voided = voidedOf(engine.voided(), engine.get());
    const seen = new Set(device.seenVoided);
    return { ...client.status(), deviceId: device.id, voided, unseen: voided.filter((v) => !seen.has(v.id)) };
  };
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
    device.seenVoided = engine.voided().map((e) => e.id);
    saveDevice(device);
    broadcast();
  });

  client.start();
  return client;
}
