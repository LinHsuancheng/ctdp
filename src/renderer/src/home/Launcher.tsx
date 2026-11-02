import { useState } from "react";
import { formatDuration, type Chain, type CtdpState } from "../../../shared/ctdp";
import { ConfirmDialog } from "../components/kit/ConfirmDialog";
import { Key } from "../components/Key";
import { dispatch } from "../hooks/useCtdp";
import { useKeys } from "../hooks/useKeys";
import { StartOptions, type StartChoice } from "./StartOptions";

interface Props {
  state: CtdpState;
  chain: Chain;
  now: number;
  choice: StartChoice;
  onChoice: (c: StartChoice) => void;
  onReserve: () => void;
  onAction: () => void;
}

function actionSub(state: CtdpState, choice: StartChoice): string {
  const chunk = state.chunks.find((c) => c.id === choice.chunkId);
  if (!chunk) return `${choice.task.trim() || "Ad-hoc"} · ${choice.minutes} min`;
  return chunk.level === 1 ? `${chunk.name} · ${chunk.minMinutes} min` : `${chunk.name} · ${chunk.children.length} parts`;
}

/** Idle: the chain at a glance, two buttons, and below them what Action will start. */
export function Launcher({ state, chain, now, choice, onChoice, onReserve, onAction }: Props) {
  const [givingUp, setGivingUp] = useState(false);
  const r = state.reservation;
  const reservedHere = r && !r.expired && r.chainId === chain.id;
  const main = chain.main.counters[0];
  useKeys({ r: !r && onReserve, a: onAction, g: Boolean(reservedHere) && (() => setGivingUp(true)) });

  return (
    <>
      <section className="hero">
        <span className="hero-label">{chain.name}</span>
        <span className="hero-count">#{main.current}</span>
        <span className="hero-sub">
          best #{main.best} · auxiliary #{chain.auxiliary.counter.current}
        </span>
      </section>

      <div className="launch">
        {reservedHere ? (
          <div className="launch-btn reserved" aria-live="polite">
            <span className="launch-name">{formatDuration(r.deadline - now)}</span>
            <span className="launch-sub">
              Reserved — sit down in time for auxiliary #{chain.auxiliary.counter.current + 1}
            </span>
            <button className="ghost small" onClick={() => setGivingUp(true)}>
              Give up <Key k="G" />
            </button>
          </div>
        ) : (
          <button className="launch-btn reserve" disabled={Boolean(r)} onClick={onReserve}>
            <span className="launch-name">
              Reserve <Key k="R" />
            </span>
            <span className="launch-sub">{r ? "Another reservation is running" : `${chain.auxiliary.signal} · ${chain.auxiliary.windowMin} min`}</span>
          </button>
        )}
        <button className="launch-btn action" onClick={onAction}>
          <span className="launch-name">
            Action <Key k="A" />
          </span>
          <span className="launch-sub">{actionSub(state, choice)}</span>
        </button>
      </div>

      <StartOptions state={state} value={choice} onChange={onChoice} />

      {givingUp && (
        <ConfirmDialog
          title="Give up the reservation?"
          confirmLabel="Give up"
          onConfirm={() => void dispatch({ type: "cancelReservation" }).then(() => setGivingUp(false))}
          onCancel={() => setGivingUp(false)}
        >
          It counts as a missed reservation and has to be judged right away: break the auxiliary track, or allow the situation forever.
        </ConfirmDialog>
      )}
    </>
  );
}
