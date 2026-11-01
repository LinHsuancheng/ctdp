import { chainOf, formatDuration } from "../../shared/ctdp";
import { ProgressBar } from "./components/ProgressBar";
import { useCtdpState, useNow } from "./hooks/useCtdp";

export function MiniApp() {
  const state = useCtdpState();
  const now = useNow(500);
  if (!state) return null;

  const { seat, reservation } = state;
  let label = "Idle";
  let time = "--:--";
  let caption = "";
  let progress = 0;
  if (seat) {
    const minMs = seat.node.spec.minMinutes * 60_000;
    const elapsed = now - seat.node.startedAt;
    label = `Seated · ${chainOf(state, seat.chainId)?.name ?? ""}`;
    time = formatDuration(elapsed);
    caption = elapsed < minMs ? `#${seat.node.number} ${seat.node.task} · min in ${formatDuration(minMs - elapsed)}` : `#${seat.node.number} ${seat.node.task} · minimum reached`;
    progress = minMs ? elapsed / minMs : 1;
  } else if (reservation) {
    label = `Reserved · ${chainOf(state, reservation.chainId)?.name ?? ""}`;
    time = reservation.expired ? "0:00" : formatDuration(reservation.deadline - now);
    caption = reservation.expired ? "Missed — judge it in the main window" : "Sit down before it runs out";
    progress = (now - reservation.reservedAt) / (reservation.deadline - reservation.reservedAt);
  }

  return (
    <div className={`mini ${seat ? "seated" : ""}`}>
      <div className="mini-top">
        <span className="mini-label">{label}</span>
        <span className="mini-actions">
          <button title="Open CTDP" onClick={() => window.ctdp.openMain()}>⤢</button>
          <button title="Hide for now" onClick={() => window.ctdp.hideMini()}>×</button>
        </span>
      </div>
      <div className="mini-time">{time}</div>
      <div className="mini-caption">{caption}</div>
      <ProgressBar value={progress} />
    </div>
  );
}
