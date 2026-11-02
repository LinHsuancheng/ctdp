import { clampInt, text } from "./defaults";

/** What Action starts when nothing else is chosen: the last sitting's settings. */
export interface LastStart {
  /** Null for an ad-hoc unit. */
  chunkId: string | null;
  minutes: number;
  categoryId: string | null;
}

/** Per-device preferences; never synced. */
export interface DeviceSettings {
  /** Electron accelerator that brings up the CTDP window from anywhere. */
  summonShortcut: string;
  showMiniWindow: boolean;
  lastStart: LastStart;
  notifications: boolean;
}

export const DEFAULT_SUMMON = "Shift+Alt+Z";

export const DEFAULT_DEVICE_SETTINGS: DeviceSettings = {
  summonShortcut: DEFAULT_SUMMON,
  showMiniWindow: true,
  lastStart: { chunkId: "chunk-focus", minutes: 60, categoryId: null },
  notifications: true,
};

const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const optId = (v: unknown, fallback: string | null) => (typeof v === "string" || v === null ? v : fallback);

function sanitizeLastStart(raw: unknown, legacyChunk: unknown): LastStart {
  const d = DEFAULT_DEVICE_SETTINGS.lastStart;
  const r = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    chunkId: optId(r.chunkId, optId(legacyChunk, d.chunkId)),
    minutes: clampInt(r.minutes, d.minutes, 1, 600),
    categoryId: optId(r.categoryId, d.categoryId),
  };
}

/** Fills in defaults and drops anything malformed; older files had two shortcuts and a quick-start chunk. */
export function sanitizeDeviceSettings(raw: Record<string, unknown>): DeviceSettings {
  const d = DEFAULT_DEVICE_SETTINGS;
  return {
    summonShortcut: text(raw.summonShortcut, d.summonShortcut),
    showMiniWindow: bool(raw.showMiniWindow, d.showMiniWindow),
    lastStart: sanitizeLastStart(raw.lastStart, raw.quickStartChunkId),
    notifications: bool(raw.notifications, d.notifications),
  };
}
