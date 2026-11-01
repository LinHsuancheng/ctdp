import type { Action } from "./types";

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Validates actions crossing the IPC boundary from a renderer. */
export function isAction(v: unknown): v is Action {
  if (!isObject(v)) return false;
  switch (v.type) {
    case "reserve":
    case "cancelReserve":
    case "tick":
    case "abandon":
      return true;
    case "start":
      return typeof v.task === "string" && typeof v.minutes === "number";
    case "violation":
      return typeof v.behavior === "string" && (v.verdict === "break" || v.verdict === "allow");
    case "updateSettings":
      return isObject(v.patch);
    case "removePrecedent":
      return typeof v.id === "string";
    default:
      return false;
  }
}
