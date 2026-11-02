import { defaultState } from "./defaults";
import { isAction } from "./guards";
import type { CtdpData, LogEntry } from "./log";
import type { CtdpState } from "./types";

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/**
 * A shared state, normalised. Version 2 (single-device) states are accepted
 * and lose their settings, which are per-device now. Null for anything else.
 */
export function parseState(raw: unknown): CtdpState | null {
  if (!isObject(raw) || (raw.version !== 2 && raw.version !== 3)) return null;
  const lists = ["categories", "chunks", "chains", "history"] as const;
  if (!lists.every((k) => Array.isArray(raw[k]))) return null;
  const { settings: _settings, ...rest } = raw;
  const state = rest as unknown as CtdpState;
  return {
    ...state,
    version: 3,
    primaryChainId: typeof raw.primaryChainId === "string" ? raw.primaryChainId : null,
    successionPending: raw.successionPending === true,
    seat: isObject(raw.seat) ? state.seat : null,
    reservation: isObject(raw.reservation) ? state.reservation : null,
  };
}

function isEntry(v: unknown): v is LogEntry {
  return (
    isObject(v) &&
    typeof v.id === "string" &&
    typeof v.device === "string" &&
    typeof v.seq === "number" &&
    typeof v.at === "number" &&
    isAction(v.action) &&
    v.action.type !== "tick"
  );
}

/** A data file (snapshot + log), or a version-2 state file which becomes the snapshot. */
export function parseData(raw: unknown): CtdpData | null {
  if (isObject(raw) && raw.version === 3 && "base" in raw) {
    const base = parseState(raw.base);
    if (!base || !Array.isArray(raw.log)) return null;
    return { version: 3, base, log: raw.log.filter(isEntry) };
  }
  const base = parseState(raw);
  return base && { version: 3, base, log: [] };
}

export const emptyData = (): CtdpData => ({ version: 3, base: defaultState(), log: [] });
