import { describe, expect, it } from "vitest";
import { applyLibrary, defaultState, libraryDoc, planLibrary, reduce, type Action, type CtdpState } from "../src/shared/ctdp";

/** Applies a plan through the reducer, as the app does through the engine. */
async function apply(state: CtdpState, text: string) {
  const plan = planLibrary(state, text);
  let s = state;
  let n = 0;
  await applyLibrary(
    plan,
    (a: Action) => {
      s = reduce(s, a, { now: 1, id: () => `j${++n}` }).state;
    },
    () => s,
  );
  return { plan, state: s };
}

describe("library JSON", () => {
  it("adds categories and chunks that refer to each other by name", async () => {
    const doc = {
      categories: ["Writing"],
      chunks: [
        { name: "Draft", minutes: 45, category: "Writing" },
        { name: "Edit", minutes: 30, category: "Reading" },
        { name: "Writing block", children: ["Draft", "Edit"], keepAfter: 1 },
      ],
    };
    const { plan, state } = await apply(defaultState(), JSON.stringify(doc));
    expect(plan.errors).toEqual([]);
    expect(plan.newCategories).toEqual(["Writing", "Reading"]);
    const block = state.chunks.find((c) => c.name === "Writing block")!;
    expect(block.level).toBe(2);
    expect(block.minChildren).toBe(1);
    expect(block.children.map((id) => state.chunks.find((c) => c.id === id)!.name)).toEqual(["Draft", "Edit"]);
    expect(state.chunks.find((c) => c.name === "Draft")!.categoryId).toBe(state.categories.find((c) => c.name === "Writing")!.id);
  });

  it("updates a chunk of the same name instead of adding another", async () => {
    const before = defaultState();
    const { plan, state } = await apply(before, JSON.stringify({ chunks: [{ name: "focus hour", minutes: 50 }] }));
    expect(plan.chunks[0].update).toBe(true);
    expect(state.chunks.length).toBe(before.chunks.length);
    expect(state.chunks.find((c) => c.id === "chunk-focus")!.minMinutes).toBe(50);
  });

  it("explains what is wrong and changes nothing", () => {
    const state = defaultState();
    expect(planLibrary(state, "{oops").errors[0]).toMatch(/Not valid JSON/);
    expect(planLibrary(state, JSON.stringify({ chunks: [{ name: "B", children: ["Nope"] }] })).errors[0]).toMatch(/no chunk called/);
    expect(planLibrary(state, JSON.stringify({ chunks: [{ name: "U", level: 1, children: ["Focus hour"] }] })).errors[0]).toMatch(/cannot have children/);
    expect(planLibrary(state, JSON.stringify({ chunks: [{ name: "A" }, { name: "a" }] })).errors[0]).toMatch(/twice/);
  });

  it("round-trips the current library", async () => {
    const state = defaultState();
    const { plan, state: after } = await apply(state, JSON.stringify(libraryDoc(state)));
    expect(plan.errors).toEqual([]);
    expect(libraryDoc(after)).toEqual(libraryDoc(state));
  });

  it("has no way to touch chains", () => {
    const plan = planLibrary(defaultState(), JSON.stringify({ chains: [{ name: "Sneaky" }] }));
    expect(plan.chunks).toEqual([]);
    expect(plan.newCategories).toEqual([]);
  });
});
