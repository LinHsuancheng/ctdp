import { LEVELS, type Chain, type ChainInput, type Counter, type CtdpState, type Level, type Settings } from "./types";

export const MAX_MINUTES = 600;
export const MAX_WINDOW_MINUTES = 120;
export const LEVEL_NAMES: Record<Level, string> = { 1: "Unit", 2: "Block", 3: "Day", 4: "Stretch", 5: "Week" };
export const levelMark = (level: Level) => "#".repeat(level);

export const DEFAULT_SETTINGS: Settings = {
  reserveShortcut: "CommandOrControl+Alt+R",
  startShortcut: "CommandOrControl+Alt+S",
  showMiniWindow: true,
  quickStartChunkId: "chunk-focus",
};

export const emptyCounters = (): Counter[] => LEVELS.map(() => ({ current: 0, best: 0 }));

export function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(max, Math.max(min, n));
}

export function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function newChain(id: string, input: ChainInput, now: number): Chain {
  return {
    id,
    name: text(input.name, "Chain"),
    trigger: text(input.trigger, "Sit down at the desk"),
    createdAt: now,
    main: { counters: emptyCounters(), precedents: [], open: null },
    auxiliary: {
      signal: text(input.signal, "Snap fingers once"),
      windowMin: clampInt(input.windowMin, 15, 1, MAX_WINDOW_MINUTES),
      counter: { current: 0, best: 0 },
      precedents: [],
    },
  };
}

export function defaultState(): CtdpState {
  const categories = ["Study", "Research", "Planning", "Chores", "Exercise", "Cooking"].map((name) => ({
    id: `cat-${name.toLowerCase()}`,
    name,
  }));
  return {
    version: 2,
    settings: { ...DEFAULT_SETTINGS },
    categories,
    chunks: [
      {
        id: "chunk-warmup",
        name: "Warm-up",
        level: 1,
        categoryId: "cat-research",
        minMinutes: 5,
        freeAbandon: true,
        children: [],
        minChildren: 0,
      },
      {
        id: "chunk-focus",
        name: "Focus hour",
        level: 1,
        categoryId: "cat-study",
        minMinutes: 60,
        freeAbandon: false,
        children: [],
        minChildren: 0,
      },
      {
        id: "chunk-block",
        name: "Three-hour block",
        level: 2,
        categoryId: null,
        minMinutes: 0,
        freeAbandon: false,
        children: ["chunk-focus", "chunk-focus", "chunk-focus"],
        minChildren: 3,
      },
    ],
    chains: [
      newChain(
        "chain-desk",
        { name: "Desk", trigger: "Put on headphones and sit at the desk", signal: "Snap fingers once", windowMin: 15 },
        0,
      ),
    ],
    primaryChainId: "chain-desk",
    successionPending: false,
    seat: null,
    reservation: null,
    history: [],
  };
}

/** Fills in defaults and clamps anything out of range. */
export function sanitizeSettings(raw: Record<string, unknown>): Settings {
  const d = DEFAULT_SETTINGS;
  return {
    reserveShortcut: text(raw.reserveShortcut, d.reserveShortcut),
    startShortcut: text(raw.startShortcut, d.startShortcut),
    showMiniWindow: typeof raw.showMiniWindow === "boolean" ? raw.showMiniWindow : d.showMiniWindow,
    quickStartChunkId:
      typeof raw.quickStartChunkId === "string" || raw.quickStartChunkId === null
        ? (raw.quickStartChunkId as string | null)
        : d.quickStartChunkId,
  };
}
