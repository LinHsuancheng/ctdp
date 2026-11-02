import { chainOf } from "./selectors";
import type { LogEntry } from "./log";
import type { Action, CtdpState } from "./types";

/** POST /api/seed: the first device uploads its data to an empty server. */
export interface SeedRequest {
  base: CtdpState;
  entries: LogEntry[];
}

/** GET /api/data: everything, for a device joining a server that already has data. */
export interface DataResponse {
  /** Null while the server is empty. */
  base: CtdpState | null;
  entries: LogEntry[];
  cursor: number;
}

/** POST /api/sync: send what the server lacks, receive what this device lacks. */
export interface SyncRequest {
  device: string;
  /** Server cursor from the previous response. */
  since: number;
  entries: LogEntry[];
}

export interface SyncResponse {
  /** Entries after `since`, from every device (including the ones just sent). */
  entries: LogEntry[];
  cursor: number;
  /** Highest sequence number the server holds from the requesting device. */
  ackSeq: number;
}

/** An action that lost out when logs from several devices were merged. */
export interface VoidedAction {
  id: string;
  device: string;
  at: number;
  text: string;
}

/** Short English description of an action, for merge notices. */
export function describeAction(action: Action, state: CtdpState): string {
  const name = (id: string) => chainOf(state, id)?.name ?? "a deleted chain";
  switch (action.type) {
    case "reserve":
      return `Reserve on ${name(action.chainId)}`;
    case "cancelReservation":
      return "Give up the reservation";
    case "judgeReservation":
      return action.verdict === "break" ? "Break the auxiliary track" : `Allow forever: ${action.situation}`;
    case "seat":
      return `Sit down on ${name(action.chainId)}${action.task ? ` · ${action.task}` : ""}`;
    case "finishUnit":
      return action.keep ? "Keep the unit" : "Don't keep the unit (lose chain)";
    case "abandonUnit":
      return "Leave the seat";
    case "violation":
      return action.verdict === "break" ? `Violation, break: ${action.behavior}` : `Violation, allow forever: ${action.behavior}`;
    case "settleChunk":
      return `${action.keep ? "Keep" : "Don't keep"} the open chunk on ${name(action.chainId)}`;
    case "setPrimary":
      return `Make ${name(action.chainId)} primary`;
    case "saveChain":
      return action.chainId ? `Edit chain ${action.input.name}` : `Create chain ${action.input.name}`;
    case "deleteChain":
      return `Delete chain ${name(action.chainId)}`;
    case "saveChunk":
      return `${action.chunkId ? "Edit" : "Create"} chunk ${action.input.name}`;
    case "deleteChunk":
      return "Delete a chunk";
    case "saveCategory":
      return `Save category ${action.name}`;
    case "deleteCategory":
      return "Delete a category";
    case "removePrecedent":
      return "Remove a precedent";
    case "tick":
      return "Time passes";
  }
}

export const voidedOf = (entries: LogEntry[], state: CtdpState): VoidedAction[] =>
  entries.map((e) => ({ id: e.id, device: e.device, at: e.at, text: describeAction(e.action, state) }));
