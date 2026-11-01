import { useState } from "react";
import { chainOf, formatClock, formatDuration, levelMark, pathTo, type CtdpState } from "../../../shared/ctdp";
import { dispatch } from "../hooks/useCtdp";
import { Modal } from "./Modal";
import { PrecedentDialog } from "./PrecedentDialog";
import { ProgressBar } from "./ProgressBar";

export function SeatCard({ state, now }: { state: CtdpState; now: number }) {
  const [dialog, setDialog] = useState<"violation" | "finish" | null>(null);
  const seat = state.seat;
  const chain = chainOf(state, seat?.chainId);
  if (!seat || !chain) return null;

  const { node } = seat;
  const minMs = node.spec.minMinutes * 60_000;
  const elapsed = now - node.startedAt;
  const reached = elapsed >= minMs;
  const path = seat.parentId && chain.main.open ? pathTo(chain.main.open, seat.parentId) : [];
  const lostLength = chain.main.counters[0].current;

  const leave = () => {
    if (node.spec.freeAbandon) return void dispatch({ type: "abandonUnit" });
    if (confirm(`Leaving before the minimum loses the whole ${chain.name} main track (#${lostLength}). Leave?`)) {
      void dispatch({ type: "abandonUnit" });
    }
  };

  return (
    <section className="card accent">
      <div className="meta">
        <span>
          {chain.name} · {chain.trigger}
        </span>
        <span>since {formatClock(node.startedAt)}</span>
      </div>
      {path.length > 0 && (
        <div className="breadcrumb">
          {path.map((p) => `${levelMark(p.spec.level)}${p.number} ${p.spec.name}`).join(" › ")}
        </div>
      )}
      <div className="seat-title">
        <span className="virtual-badge">#{node.number}</span>
        <span>{node.task}</span>
      </div>
      <div className="countdown big">{formatDuration(elapsed)}</div>
      <ProgressBar value={minMs ? elapsed / minMs : 1} />
      <p className="hint center">
        {reached
          ? `Minimum (${node.spec.minMinutes} min) reached. Finish whenever you are ready.`
          : `Minimum ${node.spec.minMinutes} min · ${formatDuration(minMs - elapsed)} to go. This node is virtual until you keep it.`}
      </p>
      <div className="row center">
        <button className="secondary" onClick={() => setDialog("violation")}>
          Possible violation…
        </button>
        {reached ? (
          <button className="primary" onClick={() => setDialog("finish")}>
            Finish…
          </button>
        ) : (
          <button className="ghost danger" onClick={leave}>
            {node.spec.freeAbandon ? "Abandon (free)" : "Leave (lose chain)"}
          </button>
        )}
      </div>

      {dialog === "violation" && (
        <PrecedentDialog
          title="Precedent rule"
          intro="Describe what just happened, then judge it now. Break: the whole main track is lost. Allow: this behavior is allowed on this chain forever."
          placeholder="e.g. got up for water, glanced at a message"
          precedents={chain.main.precedents}
          breakLabel={`Break chain (#${lostLength} → 0)`}
          onJudge={(verdict, behavior) => {
            void dispatch({ type: "violation", behavior, verdict });
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "finish" && (
        <Modal title="Keep this node?" onClose={() => setDialog(null)}>
          <p className="hint">
            Keep it and the virtual #{node.number} becomes a real node. Not keeping it loses the whole {chain.name} main
            track.
          </p>
          <div className="row">
            <button className="primary" onClick={() => void dispatch({ type: "finishUnit", keep: true })}>
              Keep #{node.number}
            </button>
            <button
              className="ghost danger"
              onClick={() => {
                if (confirm("Not keeping this node loses the whole chain. Sure?")) void dispatch({ type: "finishUnit", keep: false });
              }}
            >
              Don’t keep (lose chain)
            </button>
            <button className="ghost" onClick={() => setDialog(null)}>
              Back
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
