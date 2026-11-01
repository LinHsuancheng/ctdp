import { formatDateTime, orderedChains, type Chain, type CtdpState, type Track } from "../../../shared/ctdp";
import { dispatch } from "../hooks/useCtdp";

function List({ chain, track }: { chain: Chain; track: Track }) {
  const list = track === "main" ? chain.main.precedents : chain.auxiliary.precedents;
  const remove = (id: string, behavior: string) => {
    if (confirm(`Remove “${behavior}”? It will count as a violation from now on (stricter rules).`)) {
      void dispatch({ type: "removePrecedent", chainId: chain.id, track, id });
    }
  };
  if (!list.length) return <p className="empty">None yet.</p>;
  return (
    <ul className="list">
      {[...list].reverse().map((p) => (
        <li key={p.id}>
          <span className="list-main">{p.behavior}</span>
          <span className="list-meta">{formatDateTime(p.createdAt)}</span>
          <button className="ghost small" onClick={() => remove(p.id, p.behavior)}>
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}

export function PrecedentsPage({ state }: { state: CtdpState }) {
  return (
    <>
      <section className="card">
        <h2>Precedents</h2>
        <p className="hint">
          Everything ever allowed under the precedent rule. Each one was a judgment made once and kept forever: allowed once,
          allowed always.
        </p>
      </section>
      {orderedChains(state).map((c) => (
        <section key={c.id} className="card">
          <h2>{c.name}</h2>
          <h3>Main track</h3>
          <List chain={c} track="main" />
          <h3>Auxiliary track</h3>
          <List chain={c} track="auxiliary" />
        </section>
      ))}
    </>
  );
}
