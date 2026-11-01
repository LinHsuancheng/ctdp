import type { CtdpState } from "../../../shared/ctdp";
import { FocusCard } from "../components/FocusCard";
import { ReserveCard } from "../components/ReserveCard";
import { StartForm } from "../components/StartForm";
import { useNow } from "../hooks/useCtdp";

export function FocusPage({ state }: { state: CtdpState }) {
  const now = useNow();
  if (state.phase.kind === "focusing") return <FocusCard state={state} now={now} />;
  return (
    <>
      <ReserveCard state={state} now={now} />
      <StartForm state={state} />
    </>
  );
}
