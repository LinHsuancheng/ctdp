import { sanitizeDeviceSettings, type DeviceSettings } from "../ctdp";

/** Connection to a sync server. */
export interface SyncConfig {
  url: string;
  token: string;
  /** Server cursor after the last successful sync. */
  cursor: number;
  /** Highest own sequence number the server has. */
  ackSeq: number;
}

/** This device's id, sequence counter and preferences; never shared with other devices. */
export interface Device {
  id: string;
  /** Last log sequence number used on this device. */
  seq: number;
  settings: DeviceSettings;
  sync: SyncConfig | null;
  /** Voided entries the user has already been told about. */
  seenVoided: string[];
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function parseSync(raw: unknown): SyncConfig | null {
  if (!isObject(raw) || typeof raw.url !== "string" || typeof raw.token !== "string") return null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return { url: raw.url, token: raw.token, cursor: num(raw.cursor), ackSeq: num(raw.ackSeq) };
}

/** Reads a stored device record; null when it is unusable. */
export function parseDevice(raw: unknown): Device | null {
  if (!isObject(raw) || typeof raw.id !== "string" || !raw.id) return null;
  const settings = sanitizeDeviceSettings(isObject(raw.settings) ? raw.settings : {});
  const seenVoided = Array.isArray(raw.seenVoided) ? raw.seenVoided.filter((v): v is string => typeof v === "string") : [];
  return { id: raw.id, seq: typeof raw.seq === "number" ? raw.seq : 0, settings, sync: parseSync(raw.sync), seenVoided };
}

export function newDevice(id: string, settings: Partial<DeviceSettings> | Record<string, unknown> = {}): Device {
  return { id, seq: 0, settings: sanitizeDeviceSettings(settings), sync: null, seenVoided: [] };
}
