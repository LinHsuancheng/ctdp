import { orderedChains, type CtdpState } from "../../../shared/ctdp";
import { dispatch } from "../hooks/useCtdp";
import { Counters } from "./Counters";

export function SuccessionBanner({ state }: { state: CtdpState }) {
  return (
    <section className="card warn">
      <h2>Primary chain lost</h2>
      <p className="hint">Choose any chain to become the new primary. The shortcuts and tray act on the primary chain.</p>
      <ul className="list">
        {orderedChains(state).map((c) => (
          <li key={c.id}>
            <span className="list-main">{c.name}</span>
            <Counters counters={c.main.counters} />
            <button className="secondary small" onClick={() => void dispatch({ type: "setPrimary", chainId: c.id })}>
              Make primary
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
