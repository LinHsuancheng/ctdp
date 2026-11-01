import { chainOf, formatClock, formatDuration, type Chain, type CtdpState } from "../../../shared/ctdp";
import { dispatch } from "../hooks/useCtdp";
import { ProgressBar } from "./ProgressBar";

export function ReservationCard({ state, chain, now }: { state: CtdpState; chain: Chain; now: number }) {
  const r = state.reservation;
  const { auxiliary } = chain;

  if (r && !r.expired && r.chainId === chain.id) {
    const giveUp = () => {
      if (confirm("Giving up counts as a missed reservation and must be judged now. Continue?")) {
        void dispatch({ type: "cancelReservation" });
      }
    };
    return (
      <section className="card accent">
        <h2>Reserved</h2>
        <div className="countdown">{formatDuration(r.deadline - now)}</div>
        <p className="hint">
          Sit down ({chain.trigger}) by {formatClock(r.deadline)} to make auxiliary #{auxiliary.counter.current + 1}.
        </p>
        <ProgressBar value={(now - r.reservedAt) / (r.deadline - r.reservedAt)} />
        <button className="ghost danger" onClick={giveUp}>
          Give up
        </button>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>
        Auxiliary track <span className="muted">#{auxiliary.counter.current}</span>
      </h2>
      <p className="hint">
        Give the signal (<strong>{auxiliary.signal}</strong>), then sit down within {auxiliary.windowMin} minutes. Deciding
        now to start later is easier than starting now.
      </p>
      {r ? (
        <p className="hint">A reservation is already active on {chainOf(state, r.chainId)?.name}.</p>
      ) : (
        <button className="secondary" onClick={() => void dispatch({ type: "reserve", chainId: chain.id })}>
          Reserve
          {chain.id === state.primaryChainId && <span className="kbd">{state.settings.reserveShortcut}</span>}
        </button>
      )}
    </section>
  );
}
