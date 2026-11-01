import { useState } from "react";
import { canKeepComposite, keptCount, levelMark, openComposite, previewNextUnit, type Chain, type CtdpState } from "../../../shared/ctdp";
import { dispatch } from "../hooks/useCtdp";
import { NodeTree } from "./NodeTree";

/** A chunk in progress on this chain: its tree, the next unit, and settling. */
export function OpenChunkCard({ state, chain }: { state: CtdpState; chain: Chain }) {
  const [task, setTask] = useState("");
  const root = chain.main.open;
  const inner = openComposite(chain);
  if (!root || !inner) return null;

  const next = previewNextUnit(root);
  const kept = keptCount(inner);
  const label = `${levelMark(inner.spec.level)}${inner.number} ${inner.spec.name}`;
  const sit = () =>
    void dispatch({ type: "seat", chainId: chain.id, chunkId: null, task, minutes: 0, categoryId: null }).then(() => setTask(""));
  const giveUp = () => {
    if (confirm(`Not keeping ${label} loses the whole ${chain.name} main track. Sure?`)) {
      void dispatch({ type: "settleChunk", chainId: chain.id, keep: false });
    }
  };

  return (
    <section className="card accent">
      <h2>In progress</h2>
      <NodeTree root={root} seat={state.seat} />
      {next && !state.seat && (
        <div className="row">
          <input className="grow" value={task} placeholder={`Next: ${next.name} (min ${next.minMinutes} min)`} onChange={(e) => setTask(e.target.value)} />
          <button className="primary" onClick={sit}>
            Sit down
          </button>
        </div>
      )}
      <p className="hint">
        {label}: {kept} kept, {inner.spec.minChildren} needed to keep it{next ? "" : " — every part is done"}.
      </p>
      <div className="row">
        <button className="secondary" disabled={!canKeepComposite(inner) || Boolean(state.seat)} onClick={() => void dispatch({ type: "settleChunk", chainId: chain.id, keep: true })}>
          Keep {label}
        </button>
        <button className="ghost danger" disabled={Boolean(state.seat)} onClick={giveUp}>
          Don’t keep (lose chain)
        </button>
      </div>
    </section>
  );
}
