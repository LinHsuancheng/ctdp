import { describe, expect, it } from "vitest";
import { defaultState, isAction, migrate, reduce, formatDuration } from "../src/shared/ctdp";
import { DESK, MIN, T0, run, seatFocus } from "./helpers";

const chainInput = { name: "Gym", trigger: "Tie shoes", signal: "Clap", windowMin: 10 };

describe("primary chain and succession", () => {
  it("lets any chain take over after the primary is lost", () => {
    const { state } = run([
      [T0, { type: "saveChain", chainId: null, input: chainInput }],
      [T0 + MIN, seatFocus()],
      [T0 + 2 * MIN, { type: "abandonUnit" }],
    ]);
    expect(state.successionPending).toBe(true);
    const gym = state.chains.find((c) => c.name === "Gym")!;
    const after = reduce(state, { type: "setPrimary", chainId: gym.id }, { now: T0, id: () => "x" }).state;
    expect(after.primaryChainId).toBe(gym.id);
    expect(after.successionPending).toBe(false);
  });

  it("does not let the primary change while it is intact", () => {
    const { state } = run([
      [T0, { type: "saveChain", chainId: null, input: chainInput }],
      [T0, { type: "setPrimary", chainId: "id1" }],
    ]);
    expect(state.primaryChainId).toBe(DESK);
  });
});

describe("chunks", () => {
  it("rejects composites whose children are not lower level", () => {
    const initial = defaultState();
    const { state } = run(
      [[T0, { type: "saveChunk", chunkId: null, input: { name: "bad", level: 2, categoryId: null, minMinutes: 0, freeAbandon: false, children: ["chunk-block"], minChildren: 1 } }]],
      initial,
    );
    expect(state).toBe(initial);
  });

  it("refuses to delete a chunk used by another", () => {
    const initial = defaultState();
    expect(run([[T0, { type: "deleteChunk", chunkId: "chunk-focus" }]], initial).state).toBe(initial);
  });
});

describe("persistence and IPC", () => {
  it("round-trips through JSON and rejects unknown versions", () => {
    const { state } = run([[T0, seatFocus()]]);
    expect(migrate(JSON.parse(JSON.stringify(state)))).toEqual(state);
    expect(migrate({ version: 1, mainChain: 3 })).toEqual(defaultState());
  });

  it("validates actions", () => {
    expect(isAction({ type: "reserve", chainId: DESK })).toBe(true);
    expect(isAction({ type: "seat", chainId: DESK })).toBe(false);
    expect(isAction({ type: "judgeReservation", verdict: "maybe", situation: "" })).toBe(false);
    expect(isAction({ type: "drop tables" })).toBe(false);
  });

  it("formats durations", () => {
    expect(formatDuration(61_000)).toBe("1:01");
    expect(formatDuration(3_605_000)).toBe("1:00:05");
    expect(formatDuration(-1)).toBe("0:00");
  });
});
