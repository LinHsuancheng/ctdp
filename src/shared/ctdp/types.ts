/** `#` Unit … `#####` Week. */
export type Level = 1 | 2 | 3 | 4 | 5;
export const LEVELS: readonly Level[] = [1, 2, 3, 4, 5];

export interface Category {
  id: string;
  name: string;
}

/**
 * A reusable template. Level 1 is a Unit (one sitting); higher levels are an
 * ordered sequence of lower-level chunks, nested as deep as needed.
 */
export interface Chunk {
  id: string;
  name: string;
  level: Level;
  /** Unit only. */
  categoryId: string | null;
  /** Unit only: minutes before the virtual node may be kept. */
  minMinutes: number;
  /** Unit only: abandoning costs nothing (the answer's 5-minute warm-up). */
  freeAbandon: boolean;
  /** Composite only: child chunk ids in order; every child has a lower level. */
  children: string[];
  /** Composite only: kept children required before the node may be kept. */
  minChildren: number;
}

/** Frozen copy of a chunk tree taken when a node starts, so later edits never rewrite history. */
export interface ChunkSnapshot {
  /** Null for an ad-hoc unit. */
  chunkId: string | null;
  name: string;
  level: Level;
  categoryId: string | null;
  minMinutes: number;
  freeAbandon: boolean;
  minChildren: number;
  children: ChunkSnapshot[];
}

export type NodeStatus = "virtual" | "kept";

/** One execution of a chunk on a main track. Virtual until the user keeps it. */
export interface RunNode {
  id: string;
  spec: ChunkSnapshot;
  /** Tentative number at its level while virtual, final once kept. */
  number: number;
  task: string;
  startedAt: number;
  endedAt: number | null;
  status: NodeStatus;
  /** Composite only: started children (kept ones, then at most one virtual composite). */
  children: RunNode[];
}

/** 下必为例: once allowed, allowed forever on that track. */
export interface Precedent {
  id: string;
  behavior: string;
  createdAt: number;
}

export interface Counter {
  current: number;
  best: number;
}

export type Track = "main" | "auxiliary";

export interface MainTrack {
  /** Index 0 is `#`, index 4 is `#####`. */
  counters: Counter[];
  precedents: Precedent[];
  /** Outermost virtual composite in progress, if any. */
  open: RunNode | null;
}

export interface AuxiliaryTrack {
  /** The reserve signal, e.g. “snap fingers once”. */
  signal: string;
  windowMin: number;
  counter: Counter;
  precedents: Precedent[];
}

export interface Chain {
  id: string;
  name: string;
  /** The sacred-seat trigger. */
  trigger: string;
  createdAt: number;
  main: MainTrack;
  auxiliary: AuxiliaryTrack;
}

/** The unit being done right now. Only one seat at a time. */
export interface Seat {
  chainId: string;
  node: RunNode;
  /** Composite in `main.open` this unit belongs to; null for a standalone unit. */
  parentId: string | null;
  minReached: boolean;
}

export interface Reservation {
  chainId: string;
  reservedAt: number;
  deadline: number;
  /** Past the deadline (or cancelled) and waiting for a precedent judgment. */
  expired: boolean;
}

export type HistoryEntry = { id: string; at: number; chainId: string } & (
  | { kind: "kept"; level: Level; number: number; name: string; task: string; startedAt: number }
  | { kind: "mainLost"; reason: string; lengths: number[] }
  | { kind: "auxKept"; number: number }
  | { kind: "auxBroken"; length: number }
  | { kind: "precedent"; track: Track; behavior: string }
  | { kind: "primary" }
);

export type HistoryInput = HistoryEntry extends infer E ? (E extends unknown ? Omit<E, "id" | "at"> : never) : never;

export interface Settings {
  /** Electron accelerators; both act on the primary chain. */
  reserveShortcut: string;
  startShortcut: string;
  showMiniWindow: boolean;
  /** Chunk the start shortcut seats when the primary chain has nothing open. */
  quickStartChunkId: string | null;
}

export interface CtdpState {
  version: 2;
  settings: Settings;
  categories: Category[];
  chunks: Chunk[];
  chains: Chain[];
  primaryChainId: string | null;
  /** The primary chain was lost; the user picks any chain to take over. */
  successionPending: boolean;
  seat: Seat | null;
  reservation: Reservation | null;
  history: HistoryEntry[];
}

export type Verdict = "break" | "allow";

export interface ChunkInput {
  name: string;
  level: Level;
  categoryId: string | null;
  minMinutes: number;
  freeAbandon: boolean;
  children: string[];
  minChildren: number;
}

export interface ChainInput {
  name: string;
  trigger: string;
  signal: string;
  windowMin: number;
}

export type Action =
  | { type: "tick" }
  | { type: "reserve"; chainId: string }
  | { type: "cancelReservation" }
  | { type: "judgeReservation"; verdict: Verdict; situation: string }
  | { type: "seat"; chainId: string; chunkId: string | null; task: string; minutes: number; categoryId: string | null }
  | { type: "finishUnit"; keep: boolean }
  | { type: "abandonUnit" }
  | { type: "violation"; behavior: string; verdict: Verdict }
  | { type: "settleChunk"; chainId: string; keep: boolean }
  | { type: "setPrimary"; chainId: string }
  | { type: "saveChain"; chainId: string | null; input: ChainInput }
  | { type: "deleteChain"; chainId: string }
  | { type: "saveChunk"; chunkId: string | null; input: ChunkInput }
  | { type: "deleteChunk"; chunkId: string }
  | { type: "saveCategory"; categoryId: string | null; name: string }
  | { type: "deleteCategory"; categoryId: string }
  | { type: "removePrecedent"; chainId: string; track: Track; id: string }
  | { type: "updateSettings"; patch: Partial<Settings> };

/** What happened; drives notifications. */
export type DomainEvent =
  | { type: "reserved"; chainId: string; deadline: number }
  | { type: "reservationExpired"; chainId: string }
  | { type: "auxKept"; chainId: string; number: number }
  | { type: "auxBroken"; chainId: string; length: number }
  | { type: "seated"; chainId: string; number: number }
  | { type: "minReached"; chainId: string }
  | { type: "kept"; chainId: string; level: Level; number: number; name: string }
  | { type: "mainLost"; chainId: string; reason: string; length: number }
  | { type: "successionNeeded" }
  | { type: "precedentAdded"; chainId: string; track: Track; behavior: string };
