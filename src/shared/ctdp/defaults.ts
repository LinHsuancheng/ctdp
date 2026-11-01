import type { CtdpState, Settings } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  seatTrigger: "戴上耳机，坐到书桌前",
  reserveSignal: "打一个响指",
  reserveWindowMin: 15,
  defaultSessionMin: 45,
  showMiniWindow: true,
  reserveShortcut: "CommandOrControl+Alt+R",
  startShortcut: "CommandOrControl+Alt+S",
};

export const MAX_SESSION_MIN = 600;

export function defaultState(): CtdpState {
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    phase: { kind: "idle" },
    mainChain: 0,
    reserveChain: 0,
    bestMain: 0,
    bestReserve: 0,
    precedents: [],
    sessions: [],
    breaks: [],
  };
}

export function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(max, Math.max(min, n));
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

/** Fills in defaults and clamps anything out of range. */
export function sanitizeSettings(raw: Record<string, unknown>): Settings {
  const d = DEFAULT_SETTINGS;
  return {
    seatTrigger: text(raw.seatTrigger, d.seatTrigger),
    reserveSignal: text(raw.reserveSignal, d.reserveSignal),
    reserveWindowMin: clampInt(raw.reserveWindowMin, d.reserveWindowMin, 1, 120),
    defaultSessionMin: clampInt(raw.defaultSessionMin, d.defaultSessionMin, 1, MAX_SESSION_MIN),
    showMiniWindow: typeof raw.showMiniWindow === "boolean" ? raw.showMiniWindow : d.showMiniWindow,
    reserveShortcut: text(raw.reserveShortcut, d.reserveShortcut),
    startShortcut: text(raw.startShortcut, d.startShortcut),
  };
}
