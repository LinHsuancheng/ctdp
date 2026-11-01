import { addPrecedent, pushHistory, unchanged, updateChain, type Context, type Result } from "./context";
import { chainOf, findPrecedent } from "./selectors";
import { MINUTE } from "./time";
import type { CtdpState, Verdict } from "./types";

/** The reserve signal: the chain's seat must be taken within its window. */
export function reserve(state: CtdpState, chainId: string, ctx: Context): Result {
  const chain = chainOf(state, chainId);
  if (state.reservation || !chain) return unchanged(state);
  const deadline = ctx.now + chain.auxiliary.windowMin * MINUTE;
  return {
    state: { ...state, reservation: { chainId, reservedAt: ctx.now, deadline, expired: false } },
    events: [{ type: "reserved", chainId, deadline }],
  };
}

/** Giving up on a reservation is judged the same way as missing it. */
export function cancelReservation(state: CtdpState): Result {
  const r = state.reservation;
  if (!r || r.expired) return unchanged(state);
  return { state: { ...state, reservation: { ...r, expired: true } }, events: [] };
}

/** 下必为例 on the auxiliary track: break it, or allow this situation forever. */
export function judgeReservation(state: CtdpState, verdict: Verdict, situation: string, ctx: Context): Result {
  const r = state.reservation;
  const chain = chainOf(state, r?.chainId);
  if (!r || !r.expired || !chain) return unchanged(state);
  const cleared = { ...state, reservation: null };

  if (verdict === "break") {
    const length = chain.auxiliary.counter.current;
    let next = updateChain(cleared, chain.id, (c) => ({
      ...c,
      auxiliary: { ...c.auxiliary, counter: { ...c.auxiliary.counter, current: 0 } },
    }));
    next = pushHistory(next, { kind: "auxBroken", chainId: chain.id, length }, ctx);
    return { state: next, events: [{ type: "auxBroken", chainId: chain.id, length }] };
  }

  const text = situation.trim();
  if (!text) return unchanged(state);
  if (findPrecedent(chain.auxiliary.precedents, text)) return { state: cleared, events: [] };
  let next = updateChain(cleared, chain.id, (c) => ({
    ...c,
    auxiliary: { ...c.auxiliary, precedents: addPrecedent(c.auxiliary.precedents, text, ctx) },
  }));
  next = pushHistory(next, { kind: "precedent", chainId: chain.id, track: "auxiliary", behavior: text }, ctx);
  return { state: next, events: [{ type: "precedentAdded", chainId: chain.id, track: "auxiliary", behavior: text }] };
}
