import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";
import { emptyData, parseData, type CtdpData } from "../shared/ctdp";
import { newDevice, parseDevice, type Device } from "../shared/runtime";

/** Shared data (snapshot + action log): %APPDATA%\\CTDP\\ctdp-state.json on Windows. */
export const dataFile = () => join(app.getPath("userData"), "ctdp-state.json");
/** This device's id and preferences; never copied to another computer. */
export const deviceFile = () => join(app.getPath("userData"), "ctdp-device.json");

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
      const device = parseDevice(JSON.parse(readFileSync(file, "utf8")));
      if (device) return device;
      throw new Error("malformed device file");
    } catch (err) {
      setAside(file, err);
    }
  }
  const device = newDevice(randomUUID().slice(0, 8), legacySettings ?? {});
  saveDevice(device);
  return device;
}

export function saveDevice(device: Device): void {
  writeJson(deviceFile(), device);
}
