import { useState } from "react";
import type { CtdpState } from "../../../shared/ctdp";
import { formatClock, formatCountdown, progress } from "../../../shared/ctdp";
import { dispatch } from "../hooks/useCtdp";
import { ProgressBar } from "./ProgressBar";
import { ViolationDialog } from "./ViolationDialog";

export function FocusCard({ state, now }: { state: CtdpState; now: number }) {
  const [judging, setJudging] = useState(false);
  const { phase } = state;
  if (phase.kind !== "focusing") return null;

  const abandon = () => {
    if (confirm(`提前结束会让主链 #${state.mainChain} 清零。确定吗？`)) void dispatch({ type: "abandon" });
  };

  return (
    <section className="card accent focus">
      <div className="focus-meta">
        <span>第 #{state.mainChain + 1} 节</span>
        <span>
          {formatClock(phase.startedAt)} – {formatClock(phase.endsAt)} · {phase.plannedMin} 分钟
          {phase.reserved && " · 预约守约"}
        </span>
      </div>
      <h2 className="focus-task">{phase.task}</h2>
      <div className="countdown big">{formatCountdown(phase.endsAt - now)}</div>
      <ProgressBar value={progress(state, now)} />
      <div className="row">
        <button className="secondary" onClick={() => setJudging(true)}>
          疑似违规…
        </button>
        <button className="ghost danger" onClick={abandon}>
          提前结束（主链清零）
        </button>
      </div>
      {judging && <ViolationDialog state={state} onClose={() => setJudging(false)} />}
    </section>
  );
}
