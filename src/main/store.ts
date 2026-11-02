import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";
import { emptyData, parseData, sanitizeDeviceSettings, type CtdpData, type DeviceSettings } from "../shared/ctdp";

/** Shared data (snapshot + action log): %APPDATA%\\CTDP\\ctdp-state.json on Windows. */
export const dataFile = () => join(app.getPath("userData"), "ctdp-state.json");
/** This device's id and preferences; never copied to another computer. */
export const deviceFile = () => join(app.getPath("userData"), "ctdp-device.json");

export interface Device {
  id: string;
  /** Last log sequence number used on this device. */
  seq: number;
  settings: DeviceSettings;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Write-then-rename so a crash never leaves a half-written file. */
function writeJson(file: string, value: unknown): void {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  renameSync(tmp, file);
}

/** Keeps an unreadable file for inspection instead of overwriting it. */
function setAside(file: string, err: unknown): void {
  const backup = `${file}.corrupt-${Date.now()}`;
  renameSync(file, backup);
  console.error(`${file} unreadable, moved to ${backup}:`, err);
}

/**
 * Loads the shared data. A version-2 file (before multi-device) becomes the
 * snapshot, and its settings are handed back so this device can keep them.
 */
export function loadData(): { data: CtdpData; legacySettings: Record<string, unknown> | null } {
  const file = dataFile();
  if (!existsSync(file)) return { data: emptyData(), legacySettings: null };
  try {
    const raw: unknown = JSON.parse(readFileSync(file, "utf8"));
    const data = parseData(raw);
    if (!data) throw new Error("not CTDP data");
    const legacy = isObject(raw) && raw.version === 2 && isObject(raw.settings) ? raw.settings : null;
    if (legacy) writeJson(`${file}.v2-backup`, raw);
    return { data, legacySettings: legacy };
  } catch (err) {
    setAside(file, err);
    return { data: emptyData(), legacySettings: null };
  }
}

export function saveData(data: CtdpData, file = dataFile()): void {
  writeJson(file, data);
}

/** Reads an exported file; null when it is not valid CTDP data. */
export function readDataFile(file: string): CtdpData | null {
  try {
    return parseData(JSON.parse(readFileSync(file, "utf8")));
  } catch {
    return null;
  }
}

/** Copies the current data aside before it is replaced; returns the copy's path. */
export function backupData(data: CtdpData): string {
  const backup = `${dataFile()}.before-import-${Date.now()}`;
  saveData(data, backup);
  return backup;
}

export function loadDevice(legacySettings: Record<string, unknown> | null): Device {
  const file = deviceFile();
  if (existsSync(file)) {
    try {
      const raw: unknown = JSON.parse(readFileSync(file, "utf8"));
      if (isObject(raw) && typeof raw.id === "string" && raw.id) {
        const settings = sanitizeDeviceSettings(isObject(raw.settings) ? raw.settings : {});
        return { id: raw.id, seq: typeof raw.seq === "number" ? raw.seq : 0, settings };
      }
      throw new Error("malformed device file");
    } catch (err) {
      setAside(file, err);
    }
  }
  const device = { id: randomUUID().slice(0, 8), seq: 0, settings: sanitizeDeviceSettings(legacySettings ?? {}) };
  saveDevice(device);
  return device;
}

export function saveDevice(device: Device): void {
  writeJson(deviceFile(), device);
}
