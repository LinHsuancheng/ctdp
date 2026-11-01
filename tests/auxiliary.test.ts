import { describe, expect, it } from "vitest";
import { DESK, MIN, T0, desk, run, seatFocus } from "./helpers";

const reserve = { type: "reserve" as const, chainId: DESK };

describe("auxiliary track", () => {
  it("counts a reservation kept by sitting down in time", () => {
    const { state, types } = run([
      [T0, reserve],
      [T0 + 10 * MIN, seatFocus()],
    ]);
    expect(desk(state).auxiliary.counter).toEqual({ current: 1, best: 1 });
    expect(state.reservation).toBeNull();
    expect(types).toEqual(["reserved", "auxKept", "seated"]);
  });

  it("does not break by itself when the window passes; it waits for a judgment", () => {
    const { state, types } = run([
      [T0, reserve],
      [T0 + 16 * MIN, { type: "tick" }],
    ]);
    expect(types).toContain("reservationExpired");
    expect(state.reservation?.expired).toBe(true);
    expect(desk(state).auxiliary.counter.current).toBe(0);
  });

  it("judged as broken resets the auxiliary counter only", () => {
    const { state } = run([
      [T0, reserve],
      [T0 + 5 * MIN, seatFocus()],
      [T0 + 65 * MIN, { type: "finishUnit", keep: true }],
      [T0 + 70 * MIN, reserve],
      [T0 + 90 * MIN, { type: "tick" }],
      [T0 + 91 * MIN, { type: "judgeReservation", verdict: "break", situation: "" }],
    ]);
    expect(desk(state).auxiliary.counter).toEqual({ current: 0, best: 1 });
    expect(desk(state).main.counters[0].current).toBe(1);
  });

  it("judged as allowed records an auxiliary precedent and keeps the counter", () => {
    const { state } = run([
      [T0, reserve],
      [T0 + 16 * MIN, { type: "tick" }],
      [T0 + 17 * MIN, { type: "judgeReservation", verdict: "allow", situation: "Was outside" }],
    ]);
    expect(desk(state).auxiliary.precedents.map((p) => p.behavior)).toEqual(["Was outside"]);
    expect(state.reservation).toBeNull();
  });

  it("treats cancelling as a miss that needs judgment", () => {
    const { state } = run([
      [T0, reserve],
      [T0 + MIN, { type: "cancelReservation" }],
    ]);
    expect(state.reservation?.expired).toBe(true);
  });
});
