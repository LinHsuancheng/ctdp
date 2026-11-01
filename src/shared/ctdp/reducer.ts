import { cancelReservation, judgeReservation, reserve } from "./auxiliary";
import { unchanged, type Context, type Result } from "./context";
import {
  deleteCategory,
  deleteChain,
  deleteChunk,
  removePrecedent,
  saveCategory,
  saveChain,
  saveChunk,
  setPrimary,
  updateSettings,
} from "./library";
import { abandonUnit, finishUnit, seat, settleChunk, violation } from "./mainTrack";
import { MINUTE } from "./time";
import type { Action, CtdpState, DomainEvent } from "./types";

export function reduce(state: CtdpState, action: Action, ctx: Context): Result {
  switch (action.type) {
    case "tick":
      return tick(state, ctx);
    case "reserve":
      return reserve(state, action.chainId, ctx);
    case "cancelReservation":
      return cancelReservation(state);
    case "judgeReservation":
      return judgeReservation(state, action.verdict, action.situation, ctx);
    case "seat":
      return seat(state, action, ctx);
    case "finishUnit":
      return finishUnit(state, action.keep, ctx);
    case "abandonUnit":
      return abandonUnit(state, ctx);
    case "violation":
      return violation(state, action.behavior, action.verdict, ctx);
    case "settleChunk":
      return settleChunk(state, action.chainId, action.keep, ctx);
    case "setPrimary":
      return setPrimary(state, action.chainId, ctx);
    case "saveChain":
      return saveChain(state, action.chainId, action.input, ctx);
    case "deleteChain":
      return deleteChain(state, action.chainId);
    case "saveChunk":
      return saveChunk(state, action.chunkId, action.input, ctx);
    case "deleteChunk":
      return deleteChunk(state, action.chunkId);
    case "saveCategory":
      return saveCategory(state, action.categoryId, action.name, ctx);
    case "deleteCategory":
      return deleteCategory(state, action.categoryId);
    case "removePrecedent":
      return removePrecedent(state, action.chainId, action.track, action.id);
    case "updateSettings":
      return updateSettings(state, action.patch);
    default:
      return unchanged(state);
  }
}

/** Time-driven transitions: a reservation running out, a unit reaching its minimum. */
function tick(state: CtdpState, ctx: Context): Result {
  let next = state;
  const events: DomainEvent[] = [];
  const r = state.reservation;
  if (r && !r.expired && ctx.now > r.deadline) {
    next = { ...next, reservation: { ...r, expired: true } };
    events.push({ type: "reservationExpired", chainId: r.chainId });
  }
  const seat = state.seat;
  if (seat && !seat.minReached && ctx.now - seat.node.startedAt >= seat.node.spec.minMinutes * MINUTE) {
    next = { ...next, seat: { ...seat, minReached: true } };
    events.push({ type: "minReached", chainId: seat.chainId });
  }
  return { state: next, events };
}
