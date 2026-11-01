import { clampInt, MAX_MINUTES } from "./defaults";
import { addPrecedent, bump, pushHistory, unchanged, updateChain, type Context, type Result } from "./context";
import { chainOf, findPrecedent } from "./selectors";
import { MINUTE } from "./time";
import { adhocUnit, canKeepComposite, deepestVirtual, mapNode, openNextSlot, snapshot, virtualNode } from "./tree";
import type { ChunkSnapshot, CtdpState, DomainEvent, RunNode, Verdict } from "./types";

/** The whole main track is lost: every level back to zero, open virtual nodes gone. */
export function loseMain(state: CtdpState, chainId: string, reason: string, ctx: Context): Result {
  const chain = chainOf(state, chainId);
  if (!chain) return unchanged(state);
  const lengths = chain.main.counters.map((c) => c.current);
  let next = updateChain(state, chainId, (c) => ({
    ...c,
    main: { ...c.main, counters: c.main.counters.map((k) => ({ ...k, current: 0 })), open: null },
  }));
  if (next.seat?.chainId === chainId) next = { ...next, seat: null };
  const events: DomainEvent[] = [{ type: "mainLost", chainId, reason, length: lengths[0] }];
  if (state.primaryChainId === chainId) {
    next = { ...next, successionPending: true };
    events.push({ type: "successionNeeded" });
  }
  return { state: pushHistory(next, { kind: "mainLost", chainId, reason, lengths }, ctx), events };
}

interface SeatRequest {
  chainId: string;
  chunkId: string | null;
  task: string;
  minutes: number;
  categoryId: string | null;
}

/**
 * Sits down: adds a virtual unit node. Inside an open chunk the next unit is
 * fixed by the chunk; otherwise the user picks a chunk or an ad-hoc unit.
 */
export function seat(state: CtdpState, req: SeatRequest, ctx: Context): Result {
  const chain = chainOf(state, req.chainId);
  if (state.seat || !chain) return unchanged(state);
  const { counters } = chain.main;
  const task = req.task.trim();

  let open = chain.main.open;
  let parentId: string | null = null;
  let spec: ChunkSnapshot;
  if (open) {
    const slot = openNextSlot(open, counters, ctx.id, task, ctx.now);
    if (!slot) return unchanged(state);
    ({ open, parentId, spec } = slot);
  } else if (req.chunkId) {
    const snap = snapshot(req.chunkId, state.chunks);
    if (!snap) return unchanged(state);
    if (snap.level === 1) {
      spec = snap;
    } else {
      const root = virtualNode(snap, counters, ctx.id(), task, ctx.now);
      const slot = openNextSlot(root, counters, ctx.id, task, ctx.now);
      if (!slot) return unchanged(state);
      ({ open, parentId, spec } = slot);
    }
  } else {
    const minutes = clampInt(req.minutes, 60, 1, MAX_MINUTES);
    const category = state.categories.find((c) => c.id === req.categoryId);
    spec = adhocUnit(task || "Focus", minutes, category?.id ?? null);
  }

  const node = virtualNode(spec, counters, ctx.id(), task || spec.name, ctx.now);
  let next = updateChain(state, chain.id, (c) => ({ ...c, main: { ...c.main, open } }));
  next = { ...next, seat: { chainId: chain.id, node, parentId, minReached: false } };
  const events: DomainEvent[] = [];

  // Sitting down in time fulfils this chain's reservation.
  const r = state.reservation;
  if (r && r.chainId === chain.id && !r.expired && ctx.now <= r.deadline) {
    let number = 0;
    next = updateChain(next, chain.id, (c) => {
      const current = c.auxiliary.counter.current + 1;
      number = current;
      return { ...c, auxiliary: { ...c.auxiliary, counter: { current, best: Math.max(c.auxiliary.counter.best, current) } } };
    });
    next = pushHistory({ ...next, reservation: null }, { kind: "auxKept", chainId: chain.id, number }, ctx);
    events.push({ type: "auxKept", chainId: chain.id, number });
  }
  events.push({ type: "seated", chainId: chain.id, number: node.number });
  return { state: next, events };
}

/** Records a kept node at its level and returns the updated state and event. */
function keepNode(state: CtdpState, chainId: string, node: RunNode, ctx: Context): { state: CtdpState; kept: RunNode; event: DomainEvent } {
  const level = node.spec.level;
  let kept = node;
  const next = updateChain(state, chainId, (c) => {
    const counters = bump(c.main.counters, level);
    kept = { ...node, status: "kept", number: counters[level - 1].current, endedAt: ctx.now };
    return { ...c, main: { ...c.main, counters } };
  });
  const entry = {
    kind: "kept" as const,
    chainId,
    level,
    number: kept.number,
    name: kept.spec.name,
    task: kept.task,
    startedAt: kept.startedAt,
  };
  return {
    state: pushHistory(next, entry, ctx),
    kept,
    event: { type: "kept", chainId, level, number: kept.number, name: kept.spec.name },
  };
}

/** Ends the sitting after the minimum: keep it as a real node, or lose the chain. */
export function finishUnit(state: CtdpState, keep: boolean, ctx: Context): Result {
  const { seat } = state;
  if (!seat || ctx.now - seat.node.startedAt < seat.node.spec.minMinutes * MINUTE) return unchanged(state);
  if (!keep) return loseMain(state, seat.chainId, "Chose not to keep the unit", ctx);

  const { state: kept, kept: node, event } = keepNode(state, seat.chainId, seat.node, ctx);
  let next: CtdpState = { ...kept, seat: null };
  if (seat.parentId) {
    next = updateChain(next, seat.chainId, (c) => ({
      ...c,
      main: {
        ...c.main,
        open: c.main.open && mapNode(c.main.open, seat.parentId!, (p) => ({ ...p, children: [...p.children, node] })),
      },
    }));
  }
  return { state: next, events: [event] };
}

/** Leaving before the minimum loses the chain, except for free-abandon units. */
export function abandonUnit(state: CtdpState, ctx: Context): Result {
  const { seat } = state;
  if (!seat) return unchanged(state);
  if (seat.node.spec.freeAbandon) return { state: { ...state, seat: null }, events: [] };
  return loseMain(state, seat.chainId, "Left the seat before finishing", ctx);
}

/** 下必为例 on the main track while seated. */
export function violation(state: CtdpState, behavior: string, verdict: Verdict, ctx: Context): Result {
  const { seat } = state;
  const text = behavior.trim();
  const chain = chainOf(state, seat?.chainId);
  if (!seat || !chain || !text) return unchanged(state);
  if (verdict === "break") return loseMain(state, chain.id, `Violation: ${text}`, ctx);
  if (findPrecedent(chain.main.precedents, text)) return unchanged(state);
  let next = updateChain(state, chain.id, (c) => ({
    ...c,
    main: { ...c.main, precedents: addPrecedent(c.main.precedents, text, ctx) },
  }));
  next = pushHistory(next, { kind: "precedent", chainId: chain.id, track: "main", behavior: text }, ctx);
  return { state: next, events: [{ type: "precedentAdded", chainId: chain.id, track: "main", behavior: text }] };
}

/** Settles the innermost open chunk: keep (needs enough kept children) or lose the chain. */
export function settleChunk(state: CtdpState, chainId: string, keep: boolean, ctx: Context): Result {
  const chain = chainOf(state, chainId);
  const open = chain?.main.open;
  if (!chain || !open || state.seat?.chainId === chainId) return unchanged(state);
  if (!keep) return loseMain(state, chainId, "Chose not to keep the chunk", ctx);

  const target = deepestVirtual(open);
  if (!canKeepComposite(target)) return unchanged(state);
  const { state: kept, kept: node, event } = keepNode(state, chainId, target, ctx);
  const next = updateChain(kept, chainId, (c) => ({
    ...c,
    main: { ...c.main, open: target.id === open.id ? null : c.main.open && mapNode(c.main.open, target.id, () => node) },
  }));
  return { state: next, events: [event] };
}
