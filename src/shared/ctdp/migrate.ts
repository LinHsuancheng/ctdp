import { defaultState, sanitizeSettings } from "./defaults";
import type { CtdpState, Phase } from "./types";

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
const list = <T>(v: unknown): T[] => (Array.isArray(v) ? (v.filter(isObject) as T[]) : []);

function phase(v: unknown): Phase {
  if (!isObject(v)) return { kind: "idle" };
  if (v.kind === "reserved" && typeof v.deadline === "number" && typeof v.reservedAt === "number") {
    return { kind: "reserved", reservedAt: v.reservedAt, deadline: v.deadline };
  }
  if (v.kind === "focusing" && typeof v.startedAt === "number" && typeof v.endsAt === "number") {
    return {
      kind: "focusing",
      task: typeof v.task === "string" ? v.task : "专注",
      startedAt: v.startedAt,
      endsAt: v.endsAt,
      plannedMin: count(v.plannedMin),
      reserved: v.reserved === true,
    };
  }
  return { kind: "idle" };
}

/** Turns whatever was on disk into a valid state; unknown shapes fall back to defaults. */
export function migrate(raw: unknown): CtdpState {
  if (!isObject(raw) || raw.version !== 1) return defaultState();
  const mainChain = count(raw.mainChain);
  const reserveChain = count(raw.reserveChain);
  return {
    version: 1,
    settings: sanitizeSettings(isObject(raw.settings) ? raw.settings : {}),
    phase: phase(raw.phase),
    mainChain,
    reserveChain,
    bestMain: Math.max(mainChain, count(raw.bestMain)),
    bestReserve: Math.max(reserveChain, count(raw.bestReserve)),
    precedents: list(raw.precedents),
    sessions: list(raw.sessions),
    breaks: list(raw.breaks),
  };
}
