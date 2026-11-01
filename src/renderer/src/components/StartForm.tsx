import { useState } from "react";
import type { CtdpState } from "../../../shared/ctdp";
import { dispatch } from "../hooks/useCtdp";

const PRESETS = [15, 25, 45, 60, 90];

export function StartForm({ state }: { state: CtdpState }) {
  const { settings } = state;
  const [task, setTask] = useState("");
  const [minutes, setMinutes] = useState(settings.defaultSessionMin);

  const start = () => void dispatch({ type: "start", task, minutes });

  return (
    <section className="card">
      <h2>落座</h2>
      <p className="hint">
        触发动作：<strong>{settings.seatTrigger}</strong>。落座后这一节必须以最好的状态完成，完成后主链变为 #
        {state.mainChain + 1}。
      </p>
      <label className="field">
        <span>这一节做什么</span>
        <input
          value={task}
          placeholder="例如：写第三章"
          maxLength={80}
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && start()}
        />
      </label>
      <div className="field">
        <span>时长（分钟）</span>
        <div className="chips">
          {PRESETS.map((m) => (
            <button key={m} className={m === minutes ? "chip active" : "chip"} onClick={() => setMinutes(m)}>
              {m}
            </button>
          ))}
          <input
            className="chip-input"
            type="number"
            min={1}
            max={600}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
        </div>
      </div>
      <button className="primary" onClick={start}>
        落座开始 · 快捷键 {settings.startShortcut}
      </button>
    </section>
  );
}
