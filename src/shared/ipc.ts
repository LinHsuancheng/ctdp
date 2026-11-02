import type { DeviceSettings } from "./ctdp/device";
import type { Action, CtdpState } from "./ctdp/types";

export const IPC = {
  getState: "ctdp:get-state",
  dispatch: "ctdp:dispatch",
  state: "ctdp:state",
  getSettings: "ctdp:get-settings",
  updateSettings: "ctdp:update-settings",
  settings: "ctdp:settings",
  openMain: "ctdp:open-main",
  hideMini: "ctdp:hide-mini",
  dataFile: "ctdp:data-file",
  revealData: "ctdp:reveal-data",
  exportData: "ctdp:export-data",
  importData: "ctdp:import-data",
} as const;

/** Outcome of an export or import; null path means the user cancelled. */
export interface DataResult {
  ok: boolean;
  path: string | null;
  message: string;
}

/** What the preload exposes to renderers as window.ctdp. */
export interface CtdpApi {
  getState(): Promise<CtdpState>;
  dispatch(action: Action): Promise<void>;
  onState(listener: (state: CtdpState) => void): () => void;
  /** This device's preferences. */
  getSettings(): Promise<DeviceSettings>;
  updateSettings(patch: Partial<DeviceSettings>): Promise<void>;
  onSettings(listener: (settings: DeviceSettings) => void): () => void;
  openMain(): void;
  hideMini(): void;
  dataFile(): Promise<string>;
  revealData(): void;
  exportData(): Promise<DataResult>;
  importData(): Promise<DataResult>;
}
