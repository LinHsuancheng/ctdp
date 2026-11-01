import { primaryChain, type CtdpState } from "../../../shared/ctdp";
import { Counters } from "./Counters";

export function ChainHeader({ state }: { state: CtdpState }) {
  const chain = primaryChain(state);
  if (!chain) {
    return (
      <header className="summary">
        <div className="summary-title">{state.successionPending ? "Primary chain lost" : "No primary chain"}</div>
      </header>
    );
  }
  return (
    <header className="summary">
      <div>
        <div className="summary-label">Primary chain</div>
        <div className="summary-title">{chain.name}</div>
      </div>
      <div className="summary-tracks">
        <div>
          <div className="summary-label">Main</div>
          <Counters counters={chain.main.counters} />
        </div>
        <div>
          <div className="summary-label">Auxiliary</div>
          <span className="counters">
            <span className="counter">#{chain.auxiliary.counter.current}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
