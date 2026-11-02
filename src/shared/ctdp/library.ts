import { clampInt, MAX_MINUTES, MAX_WINDOW_MINUTES, newChain, sanitizeSettings, text } from "./defaults";
import { pushHistory, unchanged, updateChain, type Context, type Result } from "./context";
import { chainOf } from "./selectors";
import { LEVELS, type ChainInput, type Chunk, type ChunkInput, type CtdpState, type Settings, type Track } from "./types";

/** Any chain may take over once the primary is lost (or when there is none). */
export function setPrimary(state: CtdpState, chainId: string, ctx: Context): Result {
  const open = state.successionPending || !chainOf(state, state.primaryChainId);
  if (!open || !chainOf(state, chainId)) return unchanged(state);
  const next = { ...state, primaryChainId: chainId, successionPending: false };
  return { state: pushHistory(next, { kind: "primary", chainId }, ctx), events: [] };
}

/** Creates or edits a chain. A new chain with `primary` takes over when succession is open. */
export function saveChain(state: CtdpState, chainId: string | null, input: ChainInput, ctx: Context, primary = false): Result {
  if (chainId === null) {
    const chain = newChain(ctx.id(), input, ctx.now);
    const next = { ...state, chains: [...state.chains, chain] };
    return !state.primaryChainId || primary ? setPrimary(next, chain.id, ctx) : { state: next, events: [] };
  }
  if (!chainOf(state, chainId)) return unchanged(state);
  const next = updateChain(state, chainId, (c) => ({
    ...c,
    name: text(input.name, c.name),
    trigger: text(input.trigger, c.trigger),
    auxiliary: {
      ...c.auxiliary,
      signal: text(input.signal, c.auxiliary.signal),
      windowMin: clampInt(input.windowMin, c.auxiliary.windowMin, 1, MAX_WINDOW_MINUTES),
    },
  }));
  return { state: next, events: [] };
}

export function deleteChain(state: CtdpState, chainId: string): Result {
  const busy = state.seat?.chainId === chainId || state.reservation?.chainId === chainId;
  if (busy || !chainOf(state, chainId)) return unchanged(state);
  const chains = state.chains.filter((c) => c.id !== chainId);
  const wasPrimary = state.primaryChainId === chainId;
  return {
    state: {
      ...state,
      chains,
      primaryChainId: wasPrimary ? null : state.primaryChainId,
      successionPending: wasPrimary ? chains.length > 0 : state.successionPending,
    },
    events: [],
  };
}

/** Validates a chunk; composites keep only existing children of a strictly lower level. */
function normalizeChunk(state: CtdpState, id: string, input: ChunkInput): Chunk | null {
  const name = input.name.trim();
  if (!name || !LEVELS.includes(input.level)) return null;
  const level = input.level;
  if (level === 1) {
    return {
      id,
      name,
      level,
      categoryId: state.categories.some((c) => c.id === input.categoryId) ? input.categoryId : null,
      minMinutes: clampInt(input.minMinutes, 60, 1, MAX_MINUTES),
      freeAbandon: input.freeAbandon === true,
      children: [],
      minChildren: 0,
    };
  }
  const children = input.children.filter((cid) => {
    const child = state.chunks.find((c) => c.id === cid);
    return child && child.id !== id && child.level < level;
  });
  if (!children.length) return null;
  return {
    id,
    name,
    level,
    categoryId: null,
    minMinutes: 0,
    freeAbandon: false,
    children,
    minChildren: clampInt(input.minChildren, children.length, 1, children.length),
  };
}

export function saveChunk(state: CtdpState, chunkId: string | null, input: ChunkInput, ctx: Context): Result {
  const id = chunkId ?? ctx.id();
  const chunk = normalizeChunk(state, id, input);
  if (!chunk) return unchanged(state);
  if (chunkId === null) return { state: { ...state, chunks: [...state.chunks, chunk] }, events: [] };
  if (!state.chunks.some((c) => c.id === chunkId)) return unchanged(state);
  // A parent must stay above its children.
  const parentTooLow = state.chunks.some((p) => p.children.includes(chunkId) && p.level <= chunk.level);
  if (parentTooLow) return unchanged(state);
  return { state: { ...state, chunks: state.chunks.map((c) => (c.id === chunkId ? chunk : c)) }, events: [] };
}

export function deleteChunk(state: CtdpState, chunkId: string): Result {
  if (state.chunks.some((c) => c.children.includes(chunkId))) return unchanged(state);
  const settings =
    state.settings.quickStartChunkId === chunkId ? { ...state.settings, quickStartChunkId: null } : state.settings;
  return { state: { ...state, settings, chunks: state.chunks.filter((c) => c.id !== chunkId) }, events: [] };
}

export function saveCategory(state: CtdpState, categoryId: string | null, name: string, ctx: Context): Result {
  const clean = name.trim();
  if (!clean) return unchanged(state);
  if (categoryId === null) {
    return { state: { ...state, categories: [...state.categories, { id: ctx.id(), name: clean }] }, events: [] };
  }
  return {
    state: { ...state, categories: state.categories.map((c) => (c.id === categoryId ? { ...c, name: clean } : c)) },
    events: [],
  };
}

export function deleteCategory(state: CtdpState, categoryId: string): Result {
  return {
    state: {
      ...state,
      categories: state.categories.filter((c) => c.id !== categoryId),
      chunks: state.chunks.map((c) => (c.categoryId === categoryId ? { ...c, categoryId: null } : c)),
    },
    events: [],
  };
}

/** Removing a precedent only makes the rules stricter. */
export function removePrecedent(state: CtdpState, chainId: string, track: Track, id: string): Result {
  if (!chainOf(state, chainId)) return unchanged(state);
  const next = updateChain(state, chainId, (c) =>
    track === "main"
      ? { ...c, main: { ...c.main, precedents: c.main.precedents.filter((p) => p.id !== id) } }
      : { ...c, auxiliary: { ...c.auxiliary, precedents: c.auxiliary.precedents.filter((p) => p.id !== id) } },
  );
  return { state: next, events: [] };
}

export function updateSettings(state: CtdpState, patch: Partial<Settings>): Result {
  const settings = sanitizeSettings({ ...state.settings, ...patch });
  if (settings.quickStartChunkId && !state.chunks.some((c) => c.id === settings.quickStartChunkId)) {
    settings.quickStartChunkId = state.settings.quickStartChunkId;
  }
  return { state: { ...state, settings }, events: [] };
}
