import type { Chunk, ChunkSnapshot, Counter, RunNode } from "./types";

/** Copies a chunk and all its descendants; null if any id is missing. */
export function snapshot(chunkId: string, chunks: Chunk[]): ChunkSnapshot | null {
  const chunk = chunks.find((c) => c.id === chunkId);
  if (!chunk) return null;
  const children: ChunkSnapshot[] = [];
  for (const id of chunk.children) {
    const child = snapshot(id, chunks);
    if (!child) return null;
    children.push(child);
  }
  return {
    chunkId: chunk.id,
    name: chunk.name,
    level: chunk.level,
    categoryId: chunk.categoryId,
    minMinutes: chunk.minMinutes,
    freeAbandon: chunk.freeAbandon,
    minChildren: chunk.minChildren,
    children,
  };
}

export function adhocUnit(name: string, minutes: number, categoryId: string | null): ChunkSnapshot {
  return { chunkId: null, name, level: 1, categoryId, minMinutes: minutes, freeAbandon: false, minChildren: 0, children: [] };
}

export function virtualNode(spec: ChunkSnapshot, counters: Counter[], id: string, task: string, now: number): RunNode {
  return {
    id,
    spec,
    number: counters[spec.level - 1].current + 1,
    task,
    startedAt: now,
    endedAt: null,
    status: "virtual",
    children: [],
  };
}

/** Returns a new tree with the node `id` replaced by `fn(node)`; untouched branches are shared. */
export function mapNode(root: RunNode, id: string, fn: (node: RunNode) => RunNode): RunNode {
  if (root.id === id) return fn(root);
  let changed = false;
  const children = root.children.map((child) => {
    const mapped = mapNode(child, id, fn);
    if (mapped !== child) changed = true;
    return mapped;
  });
  return changed ? { ...root, children } : root;
}

/** The innermost virtual composite: follow the last child while it is still virtual. */
export function deepestVirtual(root: RunNode): RunNode {
  let node = root;
  for (;;) {
    const last = node.children.at(-1);
    if (!last || last.status !== "virtual") return node;
    node = last;
  }
}

export const keptCount = (node: RunNode) => node.children.filter((c) => c.status === "kept").length;

/** Composite has enough kept children to be kept. */
export const canKeepComposite = (node: RunNode) => keptCount(node) >= node.spec.minChildren;

/** The unit that would be seated next inside an open tree, or null if the innermost composite is complete. */
export function previewNextUnit(root: RunNode): ChunkSnapshot | null {
  let spec: ChunkSnapshot | undefined = (() => {
    const parent = deepestVirtual(root);
    return parent.spec.children[parent.children.length];
  })();
  while (spec && spec.level > 1) spec = spec.children[0];
  return spec ?? null;
}

export interface Slot {
  open: RunNode;
  parentId: string;
  spec: ChunkSnapshot;
}

/**
 * Finds where the next unit goes, opening virtual composites on the way down.
 * Null when the innermost composite has run out of children and must be settled.
 */
export function openNextSlot(root: RunNode, counters: Counter[], newId: () => string, task: string, now: number): Slot | null {
  let tree = root;
  let parent = deepestVirtual(root);
  for (;;) {
    const spec = parent.spec.children[parent.children.length];
    if (!spec) return null;
    if (spec.level === 1) return { open: tree, parentId: parent.id, spec };
    const child = virtualNode(spec, counters, newId(), task, now);
    tree = mapNode(tree, parent.id, (p) => ({ ...p, children: [...p.children, child] }));
    parent = child;
  }
}
