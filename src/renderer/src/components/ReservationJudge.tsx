import { chainOf, type CtdpState } from "../../../shared/ctdp";
import { dispatch } from "../hooks/useCtdp";
import { PrecedentDialog } from "./PrecedentDialog";

/** A missed reservation blocks nothing else, but it has to be judged. */
export function ReservationJudge({ state }: { state: CtdpState }) {
  const chain = chainOf(state, state.reservation?.chainId);
  if (!state.reservation?.expired || !chain) return null;
  return (
    <PrecedentDialog
      title={`Reservation missed · ${chain.name}`}
      intro="The window passed without sitting down. Break the auxiliary track, or allow this situation on this chain forever."
      placeholder="e.g. was outside when the window ended"
      precedents={chain.auxiliary.precedents}
      breakLabel={`Break auxiliary (#${chain.auxiliary.counter.current} → 0)`}
      onJudge={(verdict, situation) => void dispatch({ type: "judgeReservation", verdict, situation })}
    />
  );
}
