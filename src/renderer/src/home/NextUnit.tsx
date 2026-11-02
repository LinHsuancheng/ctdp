import { useState } from "react";
import { canKeepComposite, keptCount, levelMark, openComposite, previewNextUnit, type Chain } from "../../../shared/ctdp";
import { ConfirmDialog } from "../components/kit/ConfirmDialog";
import { HoldButton } from "../components/kit/HoldButton";
import { NodeTree } from "../components/NodeTree";
import { dispatch } from "../hooks/useCtdp";

/** Between the units of a chunk in progress: the next unit is one Action away. */
export function NextUnit({ chain, onAction }: { chain: Chain; onAction: () => void }) {
  const [dropping, setDropping] = useState(false);
  const root = chain.main.open!;
  const inner = openComposite(chain);
  const next = previewNextUnit(root);
  if (!inner) return null;
  const label = `${levelMark(inner.spec.level)}${inner.number} ${inner.spec.name}`;
  const canKeep = canKeepComposite(inner);

  return (
    <section className="next">
      <div className="seat-kicker">
        {chain.name} · {label}
      </div>
      <NodeTree root={root} seat={null} />
      <p className="hint">
        {keptCount(inner)} kept, {inner.spec.minChildren} needed to keep {label}.
      </p>
      <div className="launch single">
        {next ? (
          <button className="launch-btn action" onClick={onAction}>
            <span className="launch-name">Action</span>
            <span className="launch-sub">
              Next: {next.name} · {next.minMinutes} min
            </span>
          </button>
        ) : (
          <button className="launch-btn action" disabled={!canKeep} onClick={() => void dispatch({ type: "settleChunk", chainId: chain.id, keep: true })}>
            <span className="launch-name">Keep {label}</span>
            <span className="launch-sub">Every part is done</span>
          </button>
        )}
      </div>
      <div className="row center">
        {next && canKeep && (
          <button className="secondary" onClick={() => void dispatch({ type: "settleChunk", chainId: chain.id, keep: true })}>
            Keep {label} now
          </button>
        )}
        <HoldButton label="Hold to drop it — breaks chain" onHeld={() => setDropping(true)} />
      </div>
      {dropping && (
        <ConfirmDialog
          title="Break the chain?"
          confirmLabel="Don’t keep — break chain"
          onConfirm={() => void dispatch({ type: "settleChunk", chainId: chain.id, keep: false }).then(() => setDropping(false))}
          onCancel={() => setDropping(false)}
        >
          Not keeping {label} loses the whole {chain.name} main track. This cannot be undone.
        </ConfirmDialog>
      )}
    </section>
  );
}
