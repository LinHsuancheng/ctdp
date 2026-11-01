import type { Chain, Counter, CtdpState, DomainEvent, HistoryInput, Precedent } from "./types";

export interface Context {
  now: number;
  id: () => string;
}

export interface Result {
  /** Same object as the input when nothing changed. */
  state: CtdpState;
  events: DomainEvent[];
}

export const unchanged = (state: CtdpState): Result => ({ state, events: [] });

export function updateChain(state: CtdpState, chainId: string, fn: (chain: Chain) => Chain): CtdpState {
  return { ...state, chains: state.chains.map((c) => (c.id === chainId ? fn(c) : c)) };
}

export function pushHistory(state: CtdpState, entry: HistoryInput, ctx: Context): CtdpState {
  return { ...state, history: [...state.history, { ...entry, id: ctx.id(), at: ctx.now } as CtdpState["history"][number]] };
}

/** One more node at `level` (1-based). */
export function bump(counters: Counter[], level: number): Counter[] {
  return counters.map((c, i) => {
    if (i !== level - 1) return c;
    const current = c.current + 1;
    return { current, best: Math.max(c.best, current) };
  });
}

export const addPrecedent = (list: Precedent[], behavior: string, ctx: Context): Precedent[] => [
  ...list,
  { id: ctx.id(), behavior, createdAt: ctx.now },
];
