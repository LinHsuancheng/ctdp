import { describe, expect, it } from "vitest";
import {
  defaultState,
  formatCountdown,
  isAction,
  migrate,
  reduce,
  relatedPrecedents,
} from "../src/shared/ctdp";

describe("migrate", () => {
  it("falls back to defaults for garbage", () => {
    expect(migrate(null)).toEqual(defaultState());
    expect(migrate({ version: 99 })).toEqual(defaultState());
  });

  it("repairs bad fields and keeps good ones", () => {
    const s = migrate({
      version: 1,
      mainChain: 5,
      bestMain: 2,
      reserveChain: -3,
      settings: { reserveWindowMin: 9999, seatTrigger: "坐下" },
      phase: { kind: "focusing" },
      precedents: [{ id: "a", behavior: "喝水", createdAt: 1 }, "junk"],
    });
    expect(s.mainChain).toBe(5);
    expect(s.bestMain).toBe(5);
    expect(s.reserveChain).toBe(0);
    expect(s.settings.reserveWindowMin).toBe(120);
    expect(s.settings.seatTrigger).toBe("坐下");
    expect(s.phase.kind).toBe("idle");
    expect(s.precedents).toHaveLength(1);
  });

  it("round-trips a real state", () => {
    const r = reduce(defaultState(), { type: "start", task: "x", minutes: 10 }, { now: 1, id: () => "i" });
    expect(migrate(JSON.parse(JSON.stringify(r.state)))).toEqual(r.state);
  });
});

describe("settings", () => {
  it("sanitizes patches", () => {
    const r = reduce(
      defaultState(),
      { type: "updateSettings", patch: { defaultSessionMin: 0, seatTrigger: "  " } },
      { now: 1, id: () => "i" },
    );
    expect(r.state.settings.defaultSessionMin).toBe(1);
    expect(r.state.settings.seatTrigger).toBe(defaultState().settings.seatTrigger);
  });
});

describe("helpers", () => {
  it("formats countdowns", () => {
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(61_000)).toBe("1:01");
    expect(formatCountdown(3_600_000 + 5_000)).toBe("1:00:05");
    expect(formatCountdown(-5)).toBe("0:00");
  });

  it("finds related precedents", () => {
    const ps = [{ id: "1", behavior: "看一眼手机", createdAt: 0 }];
    expect(relatedPrecedents(ps, "手机")).toHaveLength(1);
    expect(relatedPrecedents(ps, "喝水")).toHaveLength(0);
  });

  it("validates IPC actions", () => {
    expect(isAction({ type: "reserve" })).toBe(true);
    expect(isAction({ type: "start", task: "x" })).toBe(false);
    expect(isAction({ type: "violation", behavior: "x", verdict: "maybe" })).toBe(false);
    expect(isAction({ type: "rm -rf" })).toBe(false);
  });
});
