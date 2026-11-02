import { useState } from "react";
import { chainOf, type CtdpState } from "../../../shared/ctdp";
import { dispatch } from "../hooks/useCtdp";
import { ConfirmDialog } from "./kit/ConfirmDialog";
import { PrecedentDialog } from "./PrecedentDialog";

/** A missed reservation blocks nothing else, but it has to be judged. Breaking needs no reason, only a confirmation. */
export function ReservationJudge({ state }: { state: CtdpState }) {
  const [confirming, setConfirming] = useState(false);
  const chain = chainOf(state, state.reservation?.chainId);
  if (!state.reservation?.expired || !chain) return null;
  if (confirming) {
    return (
      <ConfirmDialog
        title="Break the auxiliary track?"
        confirmLabel={`Break auxiliary (#${chain.auxiliary.counter.current} → 0)`}
        onConfirm={() => void dispatch({ type: "judgeReservation", verdict: "break", situation: "" }).then(() => setConfirming(false))}
        onCancel={() => setConfirming(false)}
      >
        The {chain.name} auxiliary track starts again from #1. This cannot be undone.
      </ConfirmDialog>
    );
  }
  return (
    <PrecedentDialog
      title={`Reservation missed · ${chain.name}`}
      intro="The window passed without sitting down. Break the auxiliary track, or describe the situation and allow it on this chain forever."
      placeholder="e.g. was outside when the window ended"
      precedents={chain.auxiliary.precedents}
      breakLabel="Break auxiliary…"
      onJudge={(verdict, situation) => (verdict === "break" ? setConfirming(true) : void dispatch({ type: "judgeReservation", verdict, situation }))}
    />
  );
}
