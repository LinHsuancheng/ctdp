import { useState } from "react";
import { orderedChains, type Chain, type CtdpState } from "../../../shared/ctdp";
import { dispatch } from "../hooks/useCtdp";
import { blankChain, ChainForm } from "./ChainForm";
import { Counters } from "./Counters";

function Candidate({ chain, note, label }: { chain: Chain; note?: string; label: string }) {
  return (
    <li>
      <span className="list-main">
        {chain.name}
        {note && <span className="list-sub">{note}</span>}
      </span>
      <Counters counters={chain.main.counters} />
      <button className="secondary small" onClick={() => void dispatch({ type: "setPrimary", chainId: chain.id })}>
        {label}
      </button>
    </li>
  );
}

export function SuccessionBanner({ state }: { state: CtdpState }) {
  const [adding, setAdding] = useState(false);
  const chains = orderedChains(state);
  // While succession is open, primaryChainId still points at the chain that was just lost.
  const lost = chains.find((c) => c.id === state.primaryChainId);
  const others = chains.filter((c) => c !== lost);

  return (
    <section className="card warn">
      <h2>Primary chain lost</h2>
      <p className="hint">Choose a chain to become the new primary, or start a new one. The shortcuts and tray act on the primary chain.</p>
      <ul className="list">
        {others.map((c) => (
          <Candidate key={c.id} chain={c} label="Make primary" />
        ))}
        {lost && <Candidate chain={lost} note="just lost, restarts from #1" label="Restart it" />}
      </ul>
      {adding ? (
        <ChainForm
          initial={blankChain}
          saveLabel="Create and make primary"
          onSave={(input) => void dispatch({ type: "saveChain", chainId: null, input, primary: true })}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <div className="row">
          <button className="secondary" onClick={() => setAdding(true)}>
            New chain
          </button>
        </div>
      )}
    </section>
  );
}
