import { defaultState, reduce, type Action, type CtdpState, type DomainEvent } from "../src/shared/ctdp";

export const T0 = 1_700_000_000_000;
export const MIN = 60_000;
export const DESK = "chain-desk";

/** Runs actions at the given times, threading state and collecting events. */
export function run(steps: Array<[number, Action]>, initial: CtdpState = defaultState()) {
  let n = 0;
  let state = initial;
  const events: DomainEvent[] = [];
  for (const [now, action] of steps) {
    const r = reduce(state, action, { now, id: () => `id${++n}` });
    state = r.state;
    events.push(...r.events);
  }
  return { state, events, types: events.map((e) => e.type) };
}

export const desk = (state: CtdpState) => state.chains.find((c) => c.id === DESK)!;
export const units = (state: CtdpState) => desk(state).main.counters[0];

export const seatFocus = (task = "read"): Action => ({
  type: "seat",
  chainId: DESK,
  chunkId: "chunk-focus",
  task,
  minutes: 0,
  categoryId: null,
});
