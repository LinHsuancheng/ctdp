import { clampInt, MAX_SESSION_MIN, sanitizeSettings } from "./defaults";
import { findPrecedent } from "./selectors";
import { MINUTE } from "./time";
import type { Action, CtdpState, DomainEvent, Phase, Verdict } from "./types";

export interface Context {
  now: number;
  id: () => string;
}

export interface Result {
  /** Same object as the input when nothing changed. */
  state: CtdpState;
  events: DomainEvent[];
}

const IDLE: Phase = { kind: "idle" };
const unchanged = (state: CtdpState): Result => ({ state, events: [] });

export function reduce(state: CtdpState, action: Action, ctx: Context): Result {
  switch (action.type) {
    case "reserve":
      return reserve(state, ctx);
    case "cancelReserve":
      return state.phase.kind === "reserved" ? breakReserve(state, ctx, "取消预约") : unchanged(state);
    case "start":
      return start(state, action.task, action.minutes, ctx);
    case "tick":
      return tick(state, ctx);
    case "violation":
      return violation(state, action.behavior, action.verdict, ctx);
    case "abandon":
      return breakMain(state, ctx, "提前结束");
    case "updateSettings":
      return { state: { ...state, settings: sanitizeSettings({ ...state.settings, ...action.patch }) }, events: [] };
    case "removePrecedent":
      return {
        state: { ...state, precedents: state.precedents.filter((p) => p.id !== action.id) },
        events: [],
      };
    default:
      return unchanged(state);
  }
}

function reserve(state: CtdpState, ctx: Context): Result {
  if (state.phase.kind !== "idle") return unchanged(state);
  const deadline = ctx.now + state.settings.reserveWindowMin * MINUTE;
  return {
    state: { ...state, phase: { kind: "reserved", reservedAt: ctx.now, deadline } },
    events: [{ type: "reserved", deadline }],
  };
}

function breakReserve(state: CtdpState, ctx: Context, reason: string): Result {
  const chainLength = state.reserveChain;
  return {
    state: {
      ...state,
      phase: IDLE,
      reserveChain: 0,
      breaks: [...state.breaks, { id: ctx.id(), kind: "reserve", at: ctx.now, chainLength, reason }],
    },
    events: [{ type: "reserveBroken", chainLength, reason }],
  };
}

function breakMain(state: CtdpState, ctx: Context, reason: string): Result {
  if (state.phase.kind !== "focusing") return unchanged(state);
  const chainLength = state.mainChain;
  return {
    state: {
      ...state,
      phase: IDLE,
      mainChain: 0,
      breaks: [...state.breaks, { id: ctx.id(), kind: "main", at: ctx.now, chainLength, reason }],
    },
    events: [{ type: "mainBroken", chainLength, reason }],
  };
}

/** 落座。守约的预约让预约链 +1；已超时的预约先按断链处理。 */
function start(state: CtdpState, task: string, minutes: number, ctx: Context): Result {
  const { phase } = state;
  if (phase.kind === "focusing") return unchanged(state);

  let next = state;
  const events: DomainEvent[] = [];
  let reserved = false;
  if (phase.kind === "reserved") {
    if (ctx.now <= phase.deadline) {
      const chain = next.reserveChain + 1;
      next = { ...next, reserveChain: chain, bestReserve: Math.max(next.bestReserve, chain) };
      events.push({ type: "reserveKept", chain });
      reserved = true;
    } else {
      const broken = breakReserve(next, ctx, "预约超时");
      next = broken.state;
      events.push(...broken.events);
    }
  }

  const plannedMin = clampInt(minutes, state.settings.defaultSessionMin, 1, MAX_SESSION_MIN);
  const endsAt = ctx.now + plannedMin * MINUTE;
  next = {
    ...next,
    phase: { kind: "focusing", task: task.trim() || "专注", startedAt: ctx.now, endsAt, plannedMin, reserved },
  };
  events.push({ type: "sessionStarted", endsAt });
  return { state: next, events };
}

function tick(state: CtdpState, ctx: Context): Result {
  const { phase } = state;
  if (phase.kind === "reserved" && ctx.now > phase.deadline) {
    return breakReserve(state, ctx, "预约超时");
  }
  if (phase.kind === "focusing" && ctx.now >= phase.endsAt) {
    const chain = state.mainChain + 1;
    return {
      state: {
        ...state,
        phase: IDLE,
        mainChain: chain,
        bestMain: Math.max(state.bestMain, chain),
        sessions: [
          ...state.sessions,
          {
            id: ctx.id(),
            task: phase.task,
            startedAt: phase.startedAt,
            endedAt: phase.endsAt,
            plannedMin: phase.plannedMin,
            chainNo: chain,
            reserved: phase.reserved,
          },
        ],
      },
      events: [{ type: "sessionCompleted", chain }],
    };
  }
  return unchanged(state);
}

/** 下必为例：疑似违规时当场判定，要么断链，要么永久允许。 */
function violation(state: CtdpState, behavior: string, verdict: Verdict, ctx: Context): Result {
  const text = behavior.trim();
  if (state.phase.kind !== "focusing" || !text) return unchanged(state);
  if (verdict === "break") return breakMain(state, ctx, `违规：${text}`);
  if (findPrecedent(state.precedents, text)) return unchanged(state);
  return {
    state: { ...state, precedents: [...state.precedents, { id: ctx.id(), behavior: text, createdAt: ctx.now }] },
    events: [{ type: "precedentAdded", behavior: text }],
  };
}
