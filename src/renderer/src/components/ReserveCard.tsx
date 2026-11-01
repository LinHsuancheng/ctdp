import type { CtdpState } from "../../../shared/ctdp";
import { formatClock, formatCountdown, progress } from "../../../shared/ctdp";
import { dispatch } from "../hooks/useCtdp";
import { ProgressBar } from "./ProgressBar";

export function ReserveCard({ state, now }: { state: CtdpState; now: number }) {
  const { phase, settings } = state;

  if (phase.kind === "reserved") {
    const cancel = () => {
      if (confirm(`取消预约会让预约链 #${state.reserveChain} 清零。确定吗？`)) void dispatch({ type: "cancelReserve" });
    };
    return (
      <section className="card accent">
        <h2>已预约</h2>
        <div className="countdown">{formatCountdown(phase.deadline - now)}</div>
        <p className="hint">在 {formatClock(phase.deadline)} 前落座，预约链变为 #{state.reserveChain + 1}。</p>
        <ProgressBar value={progress(state, now)} />
        <button className="ghost danger" onClick={cancel}>
          取消预约（预约链清零）
        </button>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>预约</h2>
      <p className="hint">
        发出信号「<strong>{settings.reserveSignal}</strong>」，之后 {settings.reserveWindowMin} 分钟内必须落座。
        预约把“要不要开始”的决定提前做掉，落座时就不用再和自己谈判。
      </p>
      <button className="secondary" onClick={() => void dispatch({ type: "reserve" })}>
        预约 · 快捷键 {settings.reserveShortcut}
      </button>
    </section>
  );
}
