import { formatClock, formatDuration, levelMark, pathTo, type Chain, type CtdpState } from "../../../shared/ctdp";
import { HoldButton } from "../components/kit/HoldButton";
import { ProgressBar } from "../components/ProgressBar";
import { dispatch } from "../hooks/useCtdp";

/** The sitting in progress, large: time, progress to the minimum, Finish once allowed. */
export function SeatView({ state, chain, now, onFinish, onLeave }: { state: CtdpState; chain: Chain; now: number; onFinish: () => void; onLeave: () => void }) {
  const seat = state.seat!;
  const { node } = seat;
  const minMs = node.spec.minMinutes * 60_000;
  const elapsed = now - node.startedAt;
  const reached = elapsed >= minMs;
  const path = seat.parentId && chain.main.open ? pathTo(chain.main.open, seat.parentId) : [];

  return (
    <section className="seat">
      <div className="seat-kicker">
        {chain.name} · since {formatClock(node.startedAt)}
      </div>
      {path.length > 0 && <div className="seat-path">{path.map((p) => `${levelMark(p.spec.level)}${p.number} ${p.spec.name}`).join(" › ")}</div>}
      <div className="seat-title">
        <span className="seat-number">#{node.number}</span>
        <span>{node.task}</span>
      </div>
      <div className="seat-time">{formatDuration(elapsed)}</div>
      <ProgressBar value={minMs ? elapsed / minMs : 1} />
      <p className="hint center">
        {reached ? "Minimum reached. Finish whenever you are ready." : `${formatDuration(minMs - elapsed)} to the ${node.spec.minMinutes}-minute minimum`}
      </p>
      <div className="seat-actions">
        {reached && (
          <button className="primary big" onClick={onFinish}>
            Finish
          </button>
        )}
        {node.spec.freeAbandon ? (
          <button className="ghost" onClick={() => void dispatch({ type: "abandonUnit" })}>
            Abandon (free)
          </button>
        ) : (
          <HoldButton label="Hold to break chain" onHeld={onLeave} />
        )}
      </div>
    </section>
  );
}
