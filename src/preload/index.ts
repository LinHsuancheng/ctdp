import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { CtdpState } from "../shared/ctdp/types";
import { IPC, type CtdpApi } from "../shared/ipc";

const api: CtdpApi = {
  getState: () => ipcRenderer.invoke(IPC.getState),
  dispatch: (action) => ipcRenderer.invoke(IPC.dispatch, action),
  onState: (listener) => {
    const handler = (_e: IpcRendererEvent, state: CtdpState) => listener(state);
    ipcRenderer.on(IPC.state, handler);
    return () => ipcRenderer.removeListener(IPC.state, handler);
  },
  openMain: () => ipcRenderer.send(IPC.openMain),
  hideMini: () => ipcRenderer.send(IPC.hideMini),
};

contextBridge.exposeInMainWorld("ctdp", api);
