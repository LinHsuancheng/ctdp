import type { Result } from "./context";
import { reduce } from "./reducer";
import type { Action, CtdpState, DomainEvent } from "./types";

/**
 * One user action as it happened on one device. Every device replays the
 * merged log in order, so the shared state is the same everywhere.
 */
export interface LogEntry {
  /** `${device}-${seq}`, unique across devices. */
  id: string;
  device: string;
  /** Per-device counter, starting at 1. */
  seq: number;
  /** Device clock, ms. */
  at: number;
  /** Never a tick: time-driven transitions are recomputed on replay. */
  action: Action;
}

/** What is stored and synced: a starting snapshot plus everything since. */
export interface CtdpData {
  version: 3;
  base: CtdpState;
  log: LogEntry[];
}

export const entryId = (device: string, seq: number) => `${device}-${seq}`;

/** Total order: time, then device, then sequence. */
export function compareEntries(a: LogEntry, b: LogEntry): number {
  return a.at - b.at || (a.device < b.device ? -1 : a.device > b.device ? 1 : 0) || a.seq - b.seq;
}

/** Ids created while applying an entry are derived from it, so replay is deterministic. */
function idsFor(entry: LogEntry): () => string {
  let n = 0;
  return () => `${entry.id}.${++n}`;
}

export interface Applied extends Result {
  /** The action itself changed the state (not just the catch-up tick). */
  effective: boolean;
}

/** Brings time up to the entry, then applies its action. */
export function applyEntry(state: CtdpState, entry: LogEntry): Applied {
  const ctx = { now: entry.at, id: idsFor(entry) };
  const ticked = reduce(state, { type: "tick" }, ctx);
  const acted = reduce(ticked.state, entry.action, ctx);
  return { state: acted.state, events: [...ticked.events, ...acted.events], effective: acted.state !== ticked.state };
}

/**
 * Replays a log over a snapshot. Only effective actions are ever logged, so an
 * entry that no longer changes anything was overruled by an earlier one from
 * another device; those are returned as voided.
 */
export function replay(base: CtdpState, log: LogEntry[]): { state: CtdpState; voided: LogEntry[] } {
  let state = base;
  const voided: LogEntry[] = [];
  for (const entry of [...log].sort(compareEntries)) {
    const r = applyEntry(state, entry);
    state = r.state;
    if (!r.effective) voided.push(entry);
  }
  return { state, voided };
}

/** Union of two logs by id, in replay order. */
export function mergeLogs(a: LogEntry[], b: LogEntry[]): LogEntry[] {
  const byId = new Map<string, LogEntry>();
  for (const e of [...a, ...b]) if (!byId.has(e.id)) byId.set(e.id, e);
  return [...byId.values()].sort(compareEntries);
}

/** Time-driven transitions at `now`, e.g. after loading or every second. */
export const tickAt = (state: CtdpState, now: number): Result => reduce(state, { type: "tick" }, { now, id: () => `tick-${now}` });

export type { DomainEvent };
