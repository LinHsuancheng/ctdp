import { MAX_MINUTES } from "./defaults";
import { LEVELS, type Action, type ChunkInput, type CtdpState, type Level } from "./types";

/**
 * The library as plain JSON, so an agent can write it: categories, and
 * chunks that refer to categories and to each other by name. Chains are
 * deliberately not part of it.
 */
export interface LibraryDoc {
  categories?: string[];
  chunks?: ChunkDoc[];
}

export interface ChunkDoc {
  name: string;
  /** 1 Unit … 5 Week; defaults to 1, or 2 when it has children. */
  level?: number;
  /** Unit only: minimum minutes. */
  minutes?: number;
  /** Unit only: a category name; created if new. */
  category?: string | null;
  /** Unit only. */
  freeAbandon?: boolean;
  /** Composite only: names of lower-level chunks, in order. */
  children?: string[];
  /** Composite only: kept children needed; defaults to all. */
  keepAfter?: number;
}

export interface PlannedChunk {
  name: string;
  level: Level;
  minutes: number;
  category: string | null;
  freeAbandon: boolean;
  children: string[];
  keepAfter: number;
  /** Replaces the chunk of the same name when there is one. */
  update: boolean;
}

export interface LibraryPlan {
  errors: string[];
  newCategories: string[];
  chunks: PlannedChunk[];
}

export const EXAMPLE_LIBRARY: LibraryDoc = {
  categories: ["Study"],
  chunks: [
    { name: "Focus hour", level: 1, minutes: 60, category: "Study" },
    { name: "Morning block", level: 2, children: ["Focus hour", "Focus hour"], keepAfter: 2 },
  ],
};

const key = (s: string) => s.trim().toLowerCase();
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Reads pasted JSON and works out what it would add or change, without changing anything. */
export function planLibrary(state: CtdpState, text: string): LibraryPlan {
  const errors: string[] = [];
  const plan: LibraryPlan = { errors, newCategories: [], chunks: [] };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    errors.push(`Not valid JSON: ${(e as Error).message}`);
    return plan;
  }
  if (!isObject(raw)) {
    errors.push("Expected an object with “categories” and/or “chunks”.");
    return plan;
  }
  const categories = new Set(state.categories.map((c) => key(c.name)));
  const addCategory = (name: string) => {
    if (!categories.has(key(name))) {
      categories.add(key(name));
      plan.newCategories.push(name.trim());
    }
  };
  if (raw.categories !== undefined) {
    if (!Array.isArray(raw.categories) || !raw.categories.every((c) => typeof c === "string" && c.trim())) errors.push("“categories” must be a list of names.");
    else raw.categories.forEach((c) => addCategory(c as string));
  }
  if (raw.chunks === undefined) return plan;
  if (!Array.isArray(raw.chunks)) {
    errors.push("“chunks” must be a list.");
    return plan;
  }

  const levels = new Map(state.chunks.map((c) => [key(c.name), c.level]));
  const seen = new Set<string>();
  raw.chunks.forEach((c, i) => {
    const where = `Chunk ${i + 1}`;
    if (!isObject(c) || typeof c.name !== "string" || !c.name.trim()) return errors.push(`${where}: needs a “name”.`);
    const name = c.name.trim();
    if (seen.has(key(name))) return errors.push(`“${name}” appears twice.`);
    seen.add(key(name));
    const children = c.children === undefined ? [] : c.children;
    if (!Array.isArray(children) || !children.every((x) => typeof x === "string")) return errors.push(`${name}: “children” must be a list of chunk names.`);
    const level = c.level === undefined ? (children.length ? 2 : 1) : c.level;
    if (!LEVELS.includes(level as Level)) return errors.push(`${name}: “level” must be 1 to 5.`);
    const lv = level as Level;
    if (lv === 1) {
      if (children.length) return errors.push(`${name}: a level-1 unit cannot have children.`);
      const minutes = c.minutes === undefined ? 60 : c.minutes;
      if (typeof minutes !== "number" || !Number.isInteger(minutes) || minutes < 1 || minutes > MAX_MINUTES) return errors.push(`${name}: “minutes” must be 1 to ${MAX_MINUTES}.`);
      const category = typeof c.category === "string" && c.category.trim() ? c.category.trim() : null;
      if (category) addCategory(category);
      plan.chunks.push({ name, level: lv, minutes, category, freeAbandon: c.freeAbandon === true, children: [], keepAfter: 0, update: levels.has(key(name)) });
    } else {
      if (!children.length) return errors.push(`${name}: a level-${lv} chunk needs “children”.`);
      for (const child of children as string[]) {
        const childLevel = levels.get(key(child));
        if (childLevel === undefined) return errors.push(`${name}: no chunk called “${child}” (define it earlier in the list).`);
        if (childLevel >= lv) return errors.push(`${name}: “${child}” must be a lower level than ${lv}.`);
      }
      const keepAfter = c.keepAfter === undefined ? children.length : c.keepAfter;
      if (typeof keepAfter !== "number" || !Number.isInteger(keepAfter) || keepAfter < 1 || keepAfter > children.length)
        return errors.push(`${name}: “keepAfter” must be 1 to ${children.length}.`);
      plan.chunks.push({ name, level: lv, minutes: 0, category: null, freeAbandon: false, children: children as string[], keepAfter, update: levels.has(key(name)) });
    }
    levels.set(key(name), lv);
  });
  return plan;
}

/** The current library in the same format, to hand to an agent. */
export function libraryDoc(state: CtdpState): LibraryDoc {
  const chunkName = (id: string) => state.chunks.find((c) => c.id === id)?.name ?? "?";
  return {
    categories: state.categories.map((c) => c.name),
    chunks: state.chunks.map((c) =>
      c.level === 1
        ? { name: c.name, level: 1, minutes: c.minMinutes, category: state.categories.find((k) => k.id === c.categoryId)?.name ?? null, freeAbandon: c.freeAbandon }
        : { name: c.name, level: c.level, children: c.children.map(chunkName), keepAfter: c.minChildren },
    ),
  };
}

/** Carries out a plan one action at a time, looking names up in the state as it grows. */
export async function applyLibrary(plan: LibraryPlan, dispatch: (a: Action) => unknown, getState: () => CtdpState | Promise<CtdpState>): Promise<void> {
  for (const name of plan.newCategories) await dispatch({ type: "saveCategory", categoryId: null, name });
  for (const c of plan.chunks) {
    const state = await getState();
    const byName = (n: string) => state.chunks.find((x) => key(x.name) === key(n));
    const input: ChunkInput = {
      name: c.name,
      level: c.level,
      categoryId: c.category ? (state.categories.find((k) => key(k.name) === key(c.category!))?.id ?? null) : null,
      minMinutes: c.minutes || 60,
      freeAbandon: c.freeAbandon,
      children: c.children.map((n) => byName(n)?.id).filter((id): id is string => Boolean(id)),
      minChildren: c.keepAfter || 1,
    };
    await dispatch({ type: "saveChunk", chunkId: byName(c.name)?.id ?? null, input });
  }
}
