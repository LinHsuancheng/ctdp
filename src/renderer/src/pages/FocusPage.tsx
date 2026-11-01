import { useState } from "react";
import { chainOf, orderedChains, type CtdpState } from "../../../shared/ctdp";
import { ChainPicker } from "../components/ChainPicker";
import { OpenChunkCard } from "../components/OpenChunkCard";
import { ReservationCard } from "../components/ReservationCard";
import { ReservationJudge } from "../components/ReservationJudge";
import { SeatCard } from "../components/SeatCard";
import { StartForm } from "../components/StartForm";
import { SuccessionBanner } from "../components/SuccessionBanner";
import { useNow } from "../hooks/useCtdp";

export function FocusPage({ state }: { state: CtdpState }) {
  const now = useNow();
  const [selected, setSelected] = useState<string | null>(null);
  const chains = orderedChains(state);
  const chain = chainOf(state, state.seat?.chainId) ?? chainOf(state, selected) ?? chains[0];

  return (
    <>
      {state.successionPending && <SuccessionBanner state={state} />}
      <ReservationJudge state={state} />
      {!chain ? (
        <p className="empty">No chains yet. Create one on the Chains tab.</p>
      ) : state.seat ? (
        <>
          <SeatCard state={state} now={now} />
          {chain.main.open && <OpenChunkCard state={state} chain={chain} />}
        </>
      ) : (
        <>
          <ChainPicker chains={chains} primaryId={state.primaryChainId} selectedId={chain.id} onSelect={setSelected} />
          <ReservationCard state={state} chain={chain} now={now} />
          {chain.main.open ? <OpenChunkCard state={state} chain={chain} /> : <StartForm key={chain.id} state={state} chain={chain} />}
        </>
      )}
    </>
  );
}
