import { describe, expect, it } from "vitest";
import { defaultState, previewNextUnit } from "../src/shared/ctdp";
import { DESK, MIN, T0, desk, run, seatFocus, units } from "./helpers";

describe("virtual unit node", () => {
  it("is virtual while seated and becomes real when kept after the minimum", () => {
    const seated = run([[T0, seatFocus()]]);
    expect(seated.state.seat?.node).toMatchObject({ status: "virtual", number: 1 });
    expect(units(seated.state).current).toBe(0);

    const { state, types } = run([
      [T0, seatFocus()],
      [T0 + 60 * MIN, { type: "tick" }],
      [T0 + 75 * MIN, { type: "finishUnit", keep: true }],
    ]);
    expect(types).toEqual(["seated", "minReached", "kept"]);
    expect(units(state)).toEqual({ current: 1, best: 1 });
    expect(state.seat).toBeNull();
  });

  it("cannot be finished before the minimum", () => {
    const { state } = run([
      [T0, seatFocus()],
      [T0 + 59 * MIN, { type: "finishUnit", keep: true }],
    ]);
    expect(state.seat).not.toBeNull();
    expect(units(state).current).toBe(0);
  });

  it("loses the whole chain when not kept", () => {
    const { state, types } = run([
      [T0, seatFocus()],
      [T0 + 60 * MIN, { type: "finishUnit", keep: true }],
      [T0 + 2 * 60 * MIN, seatFocus()],
      [T0 + 3 * 60 * MIN, { type: "finishUnit", keep: false }],
    ]);
    expect(units(state)).toEqual({ current: 0, best: 1 });
    expect(types).toContain("mainLost");
    expect(types).toContain("successionNeeded");
    expect(state.successionPending).toBe(true);
  });

  it("loses the chain when leaving before the minimum", () => {
    const { state } = run([
      [T0, seatFocus()],
      [T0 + 10 * MIN, { type: "abandonUnit" }],
    ]);
    expect(state.history.at(-1)).toMatchObject({ kind: "mainLost", reason: "Left the seat before finishing" });
  });

  it("lets a warm-up be abandoned for free", () => {
    const { state } = run([
      [T0, { type: "seat", chainId: DESK, chunkId: "chunk-warmup", task: "", minutes: 0, categoryId: null }],
      [T0 + MIN, { type: "abandonUnit" }],
    ]);
    expect(state.seat).toBeNull();
    expect(state.successionPending).toBe(false);
    expect(state.history).toHaveLength(0);
  });

  it("supports ad-hoc units with their own minimum", () => {
    const { state } = run([
      [T0, { type: "seat", chainId: DESK, chunkId: null, task: "email", minutes: 20, categoryId: "cat-chores" }],
      [T0 + 20 * MIN, { type: "finishUnit", keep: true }],
    ]);
    expect(state.history.at(-1)).toMatchObject({ kind: "kept", name: "email", level: 1 });
  });
});

describe("precedents on the main track", () => {
  it("allow forever adds one precedent and keeps the sitting", () => {
    const { state } = run([
      [T0, seatFocus()],
      [T0 + MIN, { type: "violation", behavior: "get water", verdict: "allow" }],
      [T0 + 2 * MIN, { type: "violation", behavior: " Get   water ", verdict: "allow" }],
    ]);
    expect(desk(state).main.precedents).toHaveLength(1);
    expect(state.seat).not.toBeNull();
  });

  it("break loses the chain", () => {
    const { state } = run([
      [T0, seatFocus()],
      [T0 + MIN, { type: "violation", behavior: "scrolled feed", verdict: "break" }],
    ]);
    expect(state.seat).toBeNull();
    expect(state.history.at(-1)).toMatchObject({ kind: "mainLost", reason: "Violation: scrolled feed" });
  });
});

describe("composite chunks", () => {
  const seatBlock = { type: "seat" as const, chainId: DESK, chunkId: "chunk-block", task: "thesis", minutes: 0, categoryId: null };
  const finish = { type: "finishUnit" as const, keep: true };

  it("opens a virtual block, fills it unit by unit, then keeps it", () => {
    const { state, events } = run([
      [T0, seatBlock],
      [T0 + 60 * MIN, finish],
      [T0 + 70 * MIN, seatFocus("ignored chunk, next unit is fixed")],
      [T0 + 130 * MIN, finish],
      [T0 + 140 * MIN, seatFocus()],
      [T0 + 200 * MIN, finish],
      [T0 + 201 * MIN, { type: "settleChunk", chainId: DESK, keep: true }],
    ]);
    const c = desk(state).main.counters;
    expect(c[0].current).toBe(3);
    expect(c[1].current).toBe(1);
    expect(desk(state).main.open).toBeNull();
    expect(events.filter((e) => e.type === "kept").map((e) => ("level" in e ? e.level : 0))).toEqual([1, 1, 1, 2]);
  });

  it("cannot keep the block before its minimum children", () => {
    const { state } = run([
      [T0, seatBlock],
      [T0 + 60 * MIN, finish],
      [T0 + 61 * MIN, { type: "settleChunk", chainId: DESK, keep: true }],
    ]);
    expect(desk(state).main.open?.status).toBe("virtual");
    expect(desk(state).main.counters[1].current).toBe(0);
  });

  it("not keeping the block loses every level", () => {
    const { state } = run([
      [T0, seatBlock],
      [T0 + 60 * MIN, finish],
      [T0 + 61 * MIN, { type: "settleChunk", chainId: DESK, keep: false }],
    ]);
    expect(desk(state).main.counters.map((k) => k.current)).toEqual([0, 0, 0, 0, 0]);
    expect(desk(state).main.open).toBeNull();
  });

  it("nests: a day of two blocks opens both levels virtually", () => {
    let initial = defaultState();
    initial = run(
      [[T0, { type: "saveChunk", chunkId: null, input: { name: "Day", level: 3, categoryId: null, minMinutes: 0, freeAbandon: false, children: ["chunk-block", "chunk-block"], minChildren: 2 } }]],
      initial,
    ).state;
    const dayId = initial.chunks.at(-1)!.id;
    const { state } = run(
      [[T0, { type: "seat", chainId: DESK, chunkId: dayId, task: "", minutes: 0, categoryId: null }]],
      initial,
    );
    const open = desk(state).main.open!;
    expect(open.spec.level).toBe(3);
    expect(open.children[0]).toMatchObject({ status: "virtual", spec: { level: 2 } });
    expect(state.seat?.parentId).toBe(open.children[0].id);
    expect(previewNextUnit(open)?.name).toBe("Focus hour");
  });
});
