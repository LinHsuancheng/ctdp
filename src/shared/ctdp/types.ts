/** User-tunable rules of the protocol. */
export interface Settings {
  /** 神圣座位的触发动作，例如“戴上耳机，坐到书桌前”。 */
  seatTrigger: string;
  /** 预约信号，例如“打一个响指”。 */
  reserveSignal: string;
  /** 预约后必须在多少分钟内落座。 */
  reserveWindowMin: number;
  defaultSessionMin: number;
  showMiniWindow: boolean;
  /** Electron accelerator strings. */
  reserveShortcut: string;
  startShortcut: string;
}

/** 下必为例：一旦允许，永久允许。 */
export interface Precedent {
  id: string;
  behavior: string;
  createdAt: number;
}

export interface SessionRecord {
  id: string;
  task: string;
  startedAt: number;
  endedAt: number;
  plannedMin: number;
  /** 这一节完成后主链的编号。 */
  chainNo: number;
  /** 是否由一次守约的预约引出。 */
  reserved: boolean;
}

export type ChainKind = "main" | "reserve";

export interface BreakRecord {
  id: string;
  kind: ChainKind;
  at: number;
  /** 断开前链的长度。 */
  chainLength: number;
  reason: string;
}

export type Phase =
  | { kind: "idle" }
  | { kind: "reserved"; reservedAt: number; deadline: number }
  | {
      kind: "focusing";
      task: string;
      startedAt: number;
      endsAt: number;
      plannedMin: number;
      reserved: boolean;
    };

export interface CtdpState {
  version: 1;
  settings: Settings;
  phase: Phase;
  mainChain: number;
  reserveChain: number;
  bestMain: number;
  bestReserve: number;
  precedents: Precedent[];
  sessions: SessionRecord[];
  breaks: BreakRecord[];
}

export type Verdict = "break" | "allow";

export type Action =
  | { type: "reserve" }
  | { type: "cancelReserve" }
  | { type: "start"; task: string; minutes: number }
  | { type: "tick" }
  | { type: "violation"; behavior: string; verdict: Verdict }
  | { type: "abandon" }
  | { type: "updateSettings"; patch: Partial<Settings> }
  | { type: "removePrecedent"; id: string };

/** Things that happened as a result of an action; drive notifications. */
export type DomainEvent =
  | { type: "reserved"; deadline: number }
  | { type: "reserveKept"; chain: number }
  | { type: "reserveBroken"; chainLength: number; reason: string }
  | { type: "sessionStarted"; endsAt: number }
  | { type: "sessionCompleted"; chain: number }
  | { type: "mainBroken"; chainLength: number; reason: string }
  | { type: "precedentAdded"; behavior: string };
