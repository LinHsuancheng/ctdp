import { describe, expect, it } from "vitest";
import { applyEntry, defaultState, entryId, mergeLogs, parseData, replay, type Action, type CtdpState, type LogEntry } from "../src/shared/ctdp";
import { DESK, MIN, T0, desk, seatFocus } from "./helpers";

/** Plays actions on one device the way the engine does: only effective ones are logged. */
function device(name: string, steps: Array<[number, Action]>, start: CtdpState = defaultState()) {
  let state = start;
  const log: LogEntry[] = [];
  for (const [at, action] of steps) {
    const seq = log.length + 1;
    const entry = { id: entryId(name, seq), device: name, seq, at, action };
    const r = applyEntry(state, entry);
    state = r.state;
    if (r.effective) log.push(entry);
  }
  return { state, log };
}

describe("action log", () => {
  it("replays to the same state the device saw live", () => {
    const live = device("pc", [
      [T0, { type: "reserve", chainId: DESK }],
      [T0 + 5 * MIN, seatFocus("write")],
      [T0 + 30 * MIN, { type: "violation", behavior: "Get water", verdict: "allow" }],
      [T0 + 65 * MIN, { type: "finishUnit", keep: true }],
      [T0 + 70 * MIN, { type: "saveCategory", categoryId: null, name: "Reading" }],
    ]);
    expect(live.log).toHaveLength(5);
    const { state, voided } = replay(defaultState(), live.log);
    expect(state).toEqual(live.state);
    expect(voided).toEqual([]);
  });

  it("does not log actions that change nothing", () => {
    const { log } = device("pc", [
      [T0, { type: "finishUnit", keep: true }],
      [T0, { type: "setPrimary", chainId: DESK }],
    ]);
    expect(log).toEqual([]);
  });

  it("derives ids from the entry so every device creates the same ones", () => {
    const { state } = device("pc", [[T0, { type: "saveCategory", categoryId: null, name: "Reading" }]]);
    expect(state.categories.at(-1)!.id).toBe("pc-1.1");
  });

  it("merges two devices in time order", () => {
    const phone = device("phone", [[T0, { type: "reserve", chainId: DESK }]]);
    const pc = device("pc", [[T0 + 5 * MIN, seatFocus()]], phone.state);
    const { state, voided } = replay(defaultState(), mergeLogs(pc.log, phone.log));
    expect(voided).toEqual([]);
    expect(desk(state).auxiliary.counter.current).toBe(1);
    expect(state.seat?.chainId).toBe(DESK);
  });

  it("voids the later of two offline actions that cannot both happen", () => {
    const base = device("pc", [[T0, seatFocus()]]);
    // Offline: the phone records leaving at 10 min; the PC keeps the unit at 65 min.
    const phone = device("phone", [[T0 + 10 * MIN, { type: "abandonUnit" }]], base.state);
    const pc = device("pc", [[T0 + 65 * MIN, { type: "finishUnit", keep: true }]], base.state);
    const pcLog = pc.log.map((e) => ({ ...e, id: entryId("pc", 2), seq: 2 }));
    const { state, voided } = replay(defaultState(), mergeLogs([...base.log, ...pcLog], phone.log));
    expect(desk(state).main.counters[0].current).toBe(0);
    expect(state.successionPending).toBe(true);
    expect(voided.map((e) => e.action.type)).toEqual(["finishUnit"]);
  });

  it("dedupes entries seen from both sides", () => {
    const { log } = device("pc", [[T0, seatFocus()]]);
    expect(mergeLogs(log, log)).toHaveLength(1);
  });
});

describe("data files", () => {
  it("turns a version-2 state file into a snapshot without settings", () => {
    const v2 = { ...defaultState(), version: 2, settings: { reserveShortcut: "F9" } };
    const data = parseData(JSON.parse(JSON.stringify(v2)))!;
    expect(data.log).toEqual([]);
    expect(data.base.version).toBe(3);
    expect("settings" in data.base).toBe(false);
  });

  it("drops malformed and tick entries", () => {
    const good = { id: "pc-1", device: "pc", seq: 1, at: T0, action: seatFocus() };
    const data = parseData({
      version: 3,
      base: defaultState(),
      log: [good, { ...good, id: "pc-2", action: { type: "tick" } }, { id: "x" }],
    })!;
    expect(data.log).toEqual([good]);
  });
});
