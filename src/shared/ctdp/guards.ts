import type { Action } from "./types";

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const str = (v: unknown) => typeof v === "string";
const optStr = (v: unknown) => v === null || typeof v === "string";
const verdict = (v: unknown) => v === "break" || v === "allow";

/** Validates actions crossing the IPC boundary from a renderer. */
export function isAction(v: unknown): v is Action {
  if (!isObject(v)) return false;
  switch (v.type) {
    case "tick":
    case "cancelReservation":
    case "abandonUnit":
      return true;
    case "reserve":
    case "setPrimary":
    case "deleteChain":
      return str(v.chainId);
    case "judgeReservation":
      return verdict(v.verdict) && str(v.situation);
    case "seat":
      return str(v.chainId) && optStr(v.chunkId) && str(v.task) && typeof v.minutes === "number" && optStr(v.categoryId);
    case "finishUnit":
      return typeof v.keep === "boolean";
    case "violation":
      return str(v.behavior) && verdict(v.verdict);
    case "settleChunk":
      return str(v.chainId) && typeof v.keep === "boolean";
    case "saveChain":
      return optStr(v.chainId) && isObject(v.input) && (v.primary === undefined || typeof v.primary === "boolean");
    case "saveChunk":
      return optStr(v.chunkId) && isObject(v.input) && Array.isArray(v.input.children);
    case "deleteChunk":
      return str(v.chunkId);
    case "saveCategory":
      return optStr(v.categoryId) && str(v.name);
    case "deleteCategory":
      return str(v.categoryId);
    case "removePrecedent":
      return str(v.chainId) && (v.track === "main" || v.track === "auxiliary") && str(v.id);
    case "updateSettings":
      return isObject(v.patch);
    default:
      return false;
  }
}
