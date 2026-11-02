import { chainOf, formatDuration, previewNextUnit } from "../../shared/ctdp";
import { HoldButton } from "./components/kit/HoldButton";
import { ProgressBar } from "./components/ProgressBar";
import { dispatch, useCtdpState, useNow } from "./hooks/useCtdp";

/** The corner card: the countdown or the sitting, and the one next step. Dialogs open in the main window. */
export function MiniApp() {
  const state = useCtdpState();
  const now = useNow(500);
  if (!state) return null;

  const { seat, reservation } = state;
  const open = state.chains.find((c) => c.main.open);
  let label = "";
  let time = "";
  let caption = "";
  let progress = 0;
  let actions = null;

  if (seat) {
    const minMs = seat.node.spec.minMinutes * 60_000;
    const elapsed = now - seat.node.startedAt;
    const reached = elapsed >= minMs;
    label = `#${seat.node.number} · ${chainOf(state, seat.chainId)?.name ?? ""}`;
    time = formatDuration(elapsed);
    caption = reached ? `${seat.node.task} · minimum reached` : `${seat.node.task} · ${formatDuration(minMs - elapsed)} to go`;
    progress = minMs ? elapsed / minMs : 1;
    actions = (
      <>
        {seat.node.spec.freeAbandon ? (
          <button className="ghost small" onClick={() => void dispatch({ type: "abandonUnit" })}>
            Abandon
          </button>
        ) : (
          <HoldButton className="ghost danger small" label="Hold to leave" onHeld={() => window.ctdp.openMain("leave")} />
        )}
        {reached && (
          <button className="primary small" onClick={() => window.ctdp.openMain("sign")}>
            Finish
          </button>
        )}
      </>
    );
  } else if (reservation) {
    label = `Reserved · ${chainOf(state, reservation.chainId)?.name ?? ""}`;
    time = reservation.expired ? "0:00" : formatDuration(reservation.deadline - now);
    caption = reservation.expired ? "Missed — needs a judgment" : "Sit down before it runs out";
    progress = (now - reservation.reservedAt) / (reservation.deadline - reservation.reservedAt);
    actions = reservation.expired ? (
      <button className="primary small" onClick={() => window.ctdp.openMain()}>
        Judge
      </button>
    ) : (
      <button className="primary small" onClick={() => window.ctdp.openMain("action")}>
        Action
      </button>
    );
  } else if (open?.main.open) {
    const next = previewNextUnit(open.main.open);
    label = `Next unit · ${open.name}`;
    time = next ? next.name : "Every part done";
    caption = next ? `Minimum ${next.minMinutes} min` : "Keep it in the main window";
    progress = 0;
    actions = (
      <button className="primary small" onClick={() => window.ctdp.openMain(next ? "action" : undefined)}>
        {next ? "Action" : "Open"}
      </button>
    );
  }

  return (
    <div className={`mini ${seat ? "seated" : ""}`}>
      <div className="mini-top">
        <span className="mini-label">{label}</span>
        <span className="mini-icons">
          <button title="Open CTDP" onClick={() => window.ctdp.openMain()}>
            ⤢
          </button>
          <button title="Hide for now" onClick={() => window.ctdp.hideMini()}>
            ×
          </button>
        </span>
      </div>
      <div className="mini-body">
        <div>
          <div className={open && !seat && !reservation ? "mini-time text" : "mini-time"}>{time}</div>
          <div className="mini-caption">{caption}</div>
        </div>
        <div className="mini-actions">{actions}</div>
      </div>
      <ProgressBar value={progress} />
    </div>
  );
}
