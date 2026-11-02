import type { DeviceSettings } from "./ctdp/device";
import type { VoidedAction } from "./ctdp/sync";
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
  getSync: "ctdp:get-sync",
  sync: "ctdp:sync",
  syncConnect: "ctdp:sync-connect",
  syncDisconnect: "ctdp:sync-disconnect",
  syncNow: "ctdp:sync-now",
  ackVoided: "ctdp:ack-voided",
} as const;

export interface SyncStatus {
  /** Null when this device is not connected. */
  url: string | null;
  state: "off" | "idle" | "syncing" | "ok" | "error";
  lastSync: number | null;
  error: string | null;
}

/** What the renderer shows about syncing and merge results. */
export interface SyncView extends SyncStatus {
  deviceId: string;
  voided: VoidedAction[];
  /** Voided actions the user has not acknowledged yet. */
  unseen: VoidedAction[];
}

/** Outcome of an export or import; null path means the user cancelled. */
export interface DataResult {
  ok: boolean;
  path: string | null;
  message: string;
}

/** Lock-screen notifications on the phone, delivered by the sync server. */
export interface PushStatus {
  state: "unsupported" | "denied" | "off" | "on";
  message: string;
}

export interface Outcome {
  ok: boolean;
  message: string;
}

export interface PushApi {
  status(): Promise<PushStatus>;
  /** Must be called from a tap: it may ask for permission. */
  enable(): Promise<Outcome>;
  disable(): Promise<Outcome>;
  test(): Promise<Outcome>;
}

/**
 * What the UI talks to as window.ctdp: the preload on the desktop, or the
 * in-page host of the phone web app.
 */
export interface CtdpApi {
  platform: "desktop" | "web";
  /** Only on the web app. */
  push?: PushApi;
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
  getSync(): Promise<SyncView>;
  onSync(listener: (view: SyncView) => void): () => void;
  syncConnect(url: string, token: string): Promise<Outcome>;
  syncDisconnect(): Promise<void>;
  syncNow(): Promise<void>;
  ackVoided(): Promise<void>;
}
