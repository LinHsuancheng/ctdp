import { defaultState, sanitizeSettings } from "./defaults";
import type { CtdpState } from "./types";

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/**
 * Accepts a version-2 state from disk; anything else (including the flat
 * version-1 prototype, which was never released) starts fresh.
 */
export function migrate(raw: unknown): CtdpState {
  if (!isObject(raw) || raw.version !== 2) return defaultState();
  const lists = ["categories", "chunks", "chains", "history"] as const;
  if (!lists.every((k) => Array.isArray(raw[k]))) return defaultState();
  const state = raw as unknown as CtdpState;
  return {
    ...state,
    settings: sanitizeSettings(isObject(raw.settings) ? raw.settings : {}),
    primaryChainId: typeof raw.primaryChainId === "string" ? raw.primaryChainId : null,
    successionPending: raw.successionPending === true,
    seat: isObject(raw.seat) ? state.seat : null,
    reservation: isObject(raw.reservation) ? state.reservation : null,
  };
}
