import { describe, expect, it } from "vitest";
import { defaultState, MINUTE, reduce, type Action, type CtdpState } from "../src/shared/ctdp";

const T0 = 1_700_000_000_000;

/** Runs actions at the given times, threading state and collecting events. */
function run(steps: Array<[number, Action]>, initial: CtdpState = defaultState()) {
  let n = 0;
  let state = initial;
  const events = [];
  for (const [now, action] of steps) {
    const r = reduce(state, action, { now, id: () => `id${++n}` });
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}

describe("reservation chain", () => {
  it("keeps the chain when seated inside the window", () => {
    const { state, events } = run([
      [T0, { type: "reserve" }],
      [T0 + 10 * MINUTE, { type: "start", task: "写论文", minutes: 45 }],
    ]);
    expect(state.reserveChain).toBe(1);
    expect(state.bestReserve).toBe(1);
    expect(state.phase).toMatchObject({ kind: "focusing", task: "写论文", reserved: true });
    expect(events.map((e) => e.type)).toEqual(["reserved", "reserveKept", "sessionStarted"]);
  });

  it("breaks the chain when the window passes", () => {
    const seeded = { ...defaultState(), reserveChain: 4, bestReserve: 4 };
    const { state } = run(
      [
        [T0, { type: "reserve" }],
        [T0 + 15 * MINUTE + 1, { type: "tick" }],
      ],
      seeded,
    );
    expect(state.reserveChain).toBe(0);
    expect(state.bestReserve).toBe(4);
    expect(state.phase.kind).toBe("idle");
    expect(state.breaks).toMatchObject([{ kind: "reserve", chainLength: 4, reason: "预约超时" }]);
  });

  it("breaks an expired reservation even if start arrives before the tick", () => {
    const seeded = { ...defaultState(), reserveChain: 2 };
    const { state } = run(
      [
        [T0, { type: "reserve" }],
        [T0 + 20 * MINUTE, { type: "start", task: "", minutes: 25 }],
      ],
      seeded,
    );
    expect(state.reserveChain).toBe(0);
    expect(state.phase).toMatchObject({ kind: "focusing", reserved: false, task: "专注" });
  });

  it("treats cancelling as a break", () => {
    const { state } = run([
      [T0, { type: "reserve" }],
      [T0 + MINUTE, { type: "cancelReserve" }],
    ]);
    expect(state.breaks).toMatchObject([{ kind: "reserve", reason: "取消预约" }]);
  });
});

describe("main chain", () => {
  it("adds a node when a session runs to the end", () => {
    const { state, events } = run([
      [T0, { type: "start", task: "读书", minutes: 30 }],
      [T0 + 30 * MINUTE, { type: "tick" }],
    ]);
    expect(state.mainChain).toBe(1);
    expect(state.phase.kind).toBe("idle");
    expect(state.sessions).toMatchObject([{ task: "读书", chainNo: 1, plannedMin: 30 }]);
    expect(events.at(-1)).toEqual({ type: "sessionCompleted", chain: 1 });
  });

  it("resets to zero on a judged violation and keeps the best", () => {
    const seeded = { ...defaultState(), mainChain: 7, bestMain: 7 };
    const { state } = run(
      [
        [T0, { type: "start", task: "x", minutes: 30 }],
        [T0 + MINUTE, { type: "violation", behavior: "刷微博", verdict: "break" }],
      ],
      seeded,
    );
    expect(state.mainChain).toBe(0);
    expect(state.bestMain).toBe(7);
    expect(state.breaks).toMatchObject([{ kind: "main", chainLength: 7, reason: "违规：刷微博" }]);
  });

  it("resets on abandon", () => {
    const { state } = run([
      [T0, { type: "start", task: "x", minutes: 30 }],
      [T0 + MINUTE, { type: "abandon" }],
    ]);
    expect(state.breaks).toMatchObject([{ kind: "main", reason: "提前结束" }]);
  });

  it("clamps the session length", () => {
    const { state } = run([[T0, { type: "start", task: "x", minutes: 100000 }]]);
    expect(state.phase).toMatchObject({ plannedMin: 600 });
  });
});

describe("precedents", () => {
  it("allowing records a permanent precedent once", () => {
    const { state, events } = run([
      [T0, { type: "start", task: "x", minutes: 30 }],
      [T0 + MINUTE, { type: "violation", behavior: "看一眼 手机", verdict: "allow" }],
      [T0 + 2 * MINUTE, { type: "violation", behavior: " 看一眼   手机 ", verdict: "allow" }],
    ]);
    expect(state.precedents).toHaveLength(1);
    expect(state.phase.kind).toBe("focusing");
    expect(events.filter((e) => e.type === "precedentAdded")).toHaveLength(1);
  });

  it("ignores violations outside a session", () => {
    const initial = defaultState();
    const { state } = run([[T0, { type: "violation", behavior: "x", verdict: "break" }]], initial);
    expect(state).toBe(initial);
  });
});

describe("no-ops", () => {
  it("returns the same object when a tick changes nothing", () => {
    const initial = defaultState();
    expect(reduce(initial, { type: "tick" }, { now: T0, id: () => "x" }).state).toBe(initial);
  });

  it("does not reserve while focusing", () => {
    const { state } = run([
      [T0, { type: "start", task: "x", minutes: 30 }],
      [T0 + MINUTE, { type: "reserve" }],
    ]);
    expect(state.phase.kind).toBe("focusing");
  });
});
