import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { DeviceSettings } from "../shared/ctdp/device";
import type { CtdpState } from "../shared/ctdp/types";
import { IPC, type CtdpApi, type Intent, type SyncView } from "../shared/ipc";

const api: CtdpApi = {
  platform: "desktop",
  getState: () => ipcRenderer.invoke(IPC.getState),
  dispatch: (action) => ipcRenderer.invoke(IPC.dispatch, action),
  onState: (listener) => {
    const handler = (_e: IpcRendererEvent, state: CtdpState) => listener(state);
    ipcRenderer.on(IPC.state, handler);
    return () => ipcRenderer.removeListener(IPC.state, handler);
  },
  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  updateSettings: (patch) => ipcRenderer.invoke(IPC.updateSettings, patch),
  onSettings: (listener) => {
    const handler = (_e: IpcRendererEvent, settings: DeviceSettings) => listener(settings);
    ipcRenderer.on(IPC.settings, handler);
    return () => ipcRenderer.removeListener(IPC.settings, handler);
  },
  openMain: (intent) => ipcRenderer.send(IPC.openMain, intent ?? null),
  hideMain: () => ipcRenderer.send(IPC.hideMain),
  hideMini: () => ipcRenderer.send(IPC.hideMini),
  onIntent: (listener) => {
    const handler = (_e: IpcRendererEvent, intent: Intent) => listener(intent);
    ipcRenderer.on(IPC.intent, handler);
    return () => ipcRenderer.removeListener(IPC.intent, handler);
  },
  shortcutStatus: () => ipcRenderer.invoke(IPC.shortcutStatus),
  testShortcut: (accelerator) => ipcRenderer.invoke(IPC.testShortcut, accelerator),
  dataFile: () => ipcRenderer.invoke(IPC.dataFile),
  revealData: () => ipcRenderer.send(IPC.revealData),
  exportData: () => ipcRenderer.invoke(IPC.exportData),
  importData: () => ipcRenderer.invoke(IPC.importData),
  getSync: () => ipcRenderer.invoke(IPC.getSync),
  onSync: (listener) => {
    const handler = (_e: IpcRendererEvent, view: SyncView) => listener(view);
    ipcRenderer.on(IPC.sync, handler);
    return () => ipcRenderer.removeListener(IPC.sync, handler);
  },
  syncConnect: (url, token) => ipcRenderer.invoke(IPC.syncConnect, url, token),
  syncDisconnect: () => ipcRenderer.invoke(IPC.syncDisconnect),
  syncNow: () => ipcRenderer.invoke(IPC.syncNow),
  ackVoided: () => ipcRenderer.invoke(IPC.ackVoided),
};

contextBridge.exposeInMainWorld("ctdp", api);
