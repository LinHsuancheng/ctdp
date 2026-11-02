import { text } from "./defaults";

/** Per-device preferences; never synced. */
export interface DeviceSettings {
  /** Electron accelerators; both act on the primary chain. */
  reserveShortcut: string;
  startShortcut: string;
  showMiniWindow: boolean;
  /** Chunk the start shortcut seats when the primary chain has nothing open. */
  quickStartChunkId: string | null;
  notifications: boolean;
}

export const DEFAULT_DEVICE_SETTINGS: DeviceSettings = {
  reserveShortcut: "CommandOrControl+Alt+R",
  startShortcut: "CommandOrControl+Alt+S",
  showMiniWindow: true,
  quickStartChunkId: "chunk-focus",
  notifications: true,
};

const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

/** Fills in defaults and drops anything malformed. */
export function sanitizeDeviceSettings(raw: Record<string, unknown>): DeviceSettings {
  const d = DEFAULT_DEVICE_SETTINGS;
  return {
    reserveShortcut: text(raw.reserveShortcut, d.reserveShortcut),
    startShortcut: text(raw.startShortcut, d.startShortcut),
    showMiniWindow: bool(raw.showMiniWindow, d.showMiniWindow),
    quickStartChunkId:
      typeof raw.quickStartChunkId === "string" || raw.quickStartChunkId === null ? raw.quickStartChunkId : d.quickStartChunkId,
    notifications: bool(raw.notifications, d.notifications),
  };
}
