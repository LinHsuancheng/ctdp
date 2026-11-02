import { useState } from "react";
import { canKeepComposite, keptCount, levelMark, openComposite, previewNextUnit, type Chain } from "../../../shared/ctdp";
import { ConfirmDialog } from "../components/kit/ConfirmDialog";
import { HoldButton } from "../components/kit/HoldButton";
import { Key } from "../components/Key";
import { NodeTree } from "../components/NodeTree";
import { useKeys } from "../hooks/useKeys";
import { dispatch } from "../hooks/useCtdp";

/** Between the units of a chunk in progress: the next unit is one Action away. */
export function NextUnit({ chain, onAction }: { chain: Chain; onAction: () => void }) {
  const [dropping, setDropping] = useState(false);
  const root = chain.main.open!;
  const inner = openComposite(chain);
  const next = previewNextUnit(root);
  const canKeep = Boolean(inner && canKeepComposite(inner));
  const keep = () => void dispatch({ type: "settleChunk", chainId: chain.id, keep: true });
  useKeys({ a: Boolean(next) && onAction, k: canKeep && keep });
  if (!inner) return null;
  const label = `${levelMark(inner.spec.level)}${inner.number} ${inner.spec.name}`;

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
            <span className="launch-name">
              Action <Key k="A" />
            </span>
            <span className="launch-sub">
              Next: {next.name} · {next.minMinutes} min
            </span>
          </button>
        ) : (
          <button className="launch-btn action" disabled={!canKeep} onClick={keep}>
            <span className="launch-name">
              Keep {label} <Key k="K" />
            </span>
            <span className="launch-sub">Every part is done</span>
          </button>
        )}
      </div>
      <div className="row center">
        {next && canKeep && (
          <button className="secondary" onClick={keep}>
            Keep {label} now <Key k="K" />
          </button>
        )}
        <HoldButton label="Hold to drop it — breaks chain" hotkey="b" onHeld={() => setDropping(true)} />
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
