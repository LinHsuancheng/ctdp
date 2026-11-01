import { deepestVirtual } from "./tree";
import type { Chain, CtdpState, Precedent, RunNode } from "./types";

const normalize = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

export function findPrecedent(precedents: Precedent[], behavior: string): Precedent | undefined {
  const key = normalize(behavior);
  return key ? precedents.find((p) => normalize(p.behavior) === key) : undefined;
}

/** Precedents that look related to what the user is typing. */
export function relatedPrecedents(precedents: Precedent[], behavior: string): Precedent[] {
  const key = normalize(behavior);
  if (!key) return [];
  return precedents.filter((p) => {
    const b = normalize(p.behavior);
    return b.includes(key) || key.includes(b);
  });
}

export const chainOf = (state: CtdpState, id: string | null | undefined): Chain | undefined =>
  id ? state.chains.find((c) => c.id === id) : undefined;

export const primaryChain = (state: CtdpState) => chainOf(state, state.primaryChainId);

/** Primary first, then by creation. */
export function orderedChains(state: CtdpState): Chain[] {
  return [...state.chains].sort(
    (a, b) => Number(b.id === state.primaryChainId) - Number(a.id === state.primaryChainId) || a.createdAt - b.createdAt,
  );
}

export const openComposite = (chain: Chain): RunNode | null => (chain.main.open ? deepestVirtual(chain.main.open) : null);

/** Milliseconds until the seated unit may be kept (negative once past it). */
export function untilMinimum(state: CtdpState, now: number): number | null {
  const { seat } = state;
  return seat ? seat.node.startedAt + seat.node.spec.minMinutes * 60_000 - now : null;
}

/** Ids of every node on the path from `root` to `id`, inclusive. */
export function pathTo(root: RunNode, id: string): RunNode[] {
  if (root.id === id) return [root];
  for (const child of root.children) {
    const path = pathTo(child, id);
    if (path.length) return [root, ...path];
  }
  return [];
}
