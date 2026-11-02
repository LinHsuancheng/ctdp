import { useState } from "react";
import { orderedChains, type Chain, type ChainInput, type CtdpState } from "../../../shared/ctdp";
import { blankChain, ChainForm } from "../components/ChainForm";
import { Counters } from "../components/Counters";
import { dispatch } from "../hooks/useCtdp";

const toInput = (c: Chain): ChainInput => ({ name: c.name, trigger: c.trigger, signal: c.auxiliary.signal, windowMin: c.auxiliary.windowMin });

export function ChainsPage({ state }: { state: CtdpState }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const remove = (c: Chain) => {
    if (confirm(`Delete ${c.name} and its records? This cannot be undone.`)) void dispatch({ type: "deleteChain", chainId: c.id });
  };

  return (
    <>
      {orderedChains(state).map((c) => (
        <section key={c.id} className="card">
          <h2>
            {c.name} {c.id === state.primaryChainId && <span className="badge">Primary</span>}
          </h2>
          {editing === c.id ? (
            <ChainForm
              initial={toInput(c)}
              onSave={(input) => void dispatch({ type: "saveChain", chainId: c.id, input }).then(() => setEditing(null))}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <>
              <p className="hint">
                Trigger: <strong>{c.trigger}</strong> · Signal: <strong>{c.auxiliary.signal}</strong>, sit within{" "}
                {c.auxiliary.windowMin} min
              </p>
              <div className="row">
                <span className="muted">Main</span>
                <Counters counters={c.main.counters} />
                <span className="muted">Auxiliary</span>
                <span className="counter">#{c.auxiliary.counter.current}</span>
              </div>
              <div className="row">
                <button className="ghost small" onClick={() => setEditing(c.id)}>
                  Edit
                </button>
                <button className="ghost small danger" onClick={() => remove(c)}>
                  Delete
                </button>
              </div>
            </>
          )}
        </section>
      ))}
      <section className="card">
        <h2>New chain</h2>
        {adding ? (
          <ChainForm
            initial={blankChain}
            onSave={(input) => void dispatch({ type: "saveChain", chainId: null, input }).then(() => setAdding(false))}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <>
            <p className="hint">Each chain has its own sacred seat, main track, auxiliary track and precedents.</p>
            <button className="secondary" onClick={() => setAdding(true)}>
              Add chain
            </button>
          </>
        )}
      </section>
    </>
  );
}
