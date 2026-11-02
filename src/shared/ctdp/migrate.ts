import { defaultState, sanitizeSettings } from "./defaults";
import type { CtdpState } from "./types";

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** A version-2 state, normalised; null for anything else (e.g. the unreleased flat version 1). */
export function parseState(raw: unknown): CtdpState | null {
  if (!isObject(raw) || raw.version !== 2) return null;
  const lists = ["categories", "chunks", "chains", "history"] as const;
  if (!lists.every((k) => Array.isArray(raw[k]))) return null;
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

/** Loads a state from disk; anything unrecognised starts fresh. */
export function migrate(raw: unknown): CtdpState {
  return parseState(raw) ?? defaultState();
}
