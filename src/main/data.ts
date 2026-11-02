import { BrowserWindow, dialog, ipcMain, shell } from "electron";
import { IPC, type DataResult } from "../shared/ipc";
import type { Engine } from "../shared/runtime";
import { backupData, dataFile, readDataFile, saveData } from "./store";

const filters = [{ name: "CTDP data", extensions: ["json"] }];
const today = () => new Date().toISOString().slice(0, 10);

/** Data location, export and import, for moving to another machine. */
export function registerDataIpc(engine: Engine): void {
  ipcMain.handle(IPC.dataFile, () => dataFile());
  ipcMain.on(IPC.revealData, () => shell.showItemInFolder(dataFile()));

  ipcMain.handle(IPC.exportData, async (e): Promise<DataResult> => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined;
    const opts = { title: "Export CTDP data", defaultPath: `ctdp-export-${today()}.json`, filters };
    const { canceled, filePath } = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts);
    if (canceled || !filePath) return { ok: false, path: null, message: "" };
    saveData(engine.getData(), filePath);
    return { ok: true, path: filePath, message: `Exported to ${filePath}` };
  });

  ipcMain.handle(IPC.importData, async (e): Promise<DataResult> => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined;
    const opts = { title: "Import CTDP data", filters, properties: ["openFile" as const] };
    const { canceled, filePaths } = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
    const file = filePaths[0];
    if (canceled || !file) return { ok: false, path: null, message: "" };
    const data = readDataFile(file);
    if (!data) return { ok: false, path: file, message: `${file} is not CTDP data; nothing was changed.` };
    const confirm = {
      type: "warning" as const,
      buttons: ["Replace", "Cancel"],
      defaultId: 1,
      cancelId: 1,
      message: "Replace all current data with the imported file?",
      detail: "Chains, chunks, precedents and history are all replaced; this device's settings stay. A backup of the current data is kept next to the data file.",
    };
    const { response } = win ? await dialog.showMessageBox(win, confirm) : await dialog.showMessageBox(confirm);
    if (response !== 0) return { ok: false, path: null, message: "" };
    const backup = backupData(engine.getData());
    engine.replace(data);
    return { ok: true, path: file, message: `Imported. The previous data was saved to ${backup}` };
  });
}
