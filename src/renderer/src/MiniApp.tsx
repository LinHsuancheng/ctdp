import { formatCountdown, phaseLabel, remainingMs, progress } from "../../shared/ctdp";
import { ProgressBar } from "./components/ProgressBar";
import { useCtdpState, useNow } from "./hooks/useCtdp";

export function MiniApp() {
  const state = useCtdpState();
  const now = useNow(500);
  if (!state) return null;

  const left = remainingMs(state, now);
  const { phase } = state;
  const caption =
    phase.kind === "focusing" ? `${phase.task} · 第 #${state.mainChain + 1} 节` : phase.kind === "reserved" ? "落座倒计时" : "";

  return (
    <div className={`mini ${phase.kind}`}>
      <div className="mini-top">
        <span className="mini-label">{phaseLabel(state)}</span>
        <span className="mini-actions">
          <button title="打开主窗口" onClick={() => window.ctdp.openMain()}>⤢</button>
          <button title="这一节不再显示" onClick={() => window.ctdp.hideMini()}>×</button>
        </span>
      </div>
      <div className="mini-time">{left === null ? "--:--" : formatCountdown(left)}</div>
      <div className="mini-caption">{caption}</div>
      <ProgressBar value={progress(state, now)} />
    </div>
  );
}
