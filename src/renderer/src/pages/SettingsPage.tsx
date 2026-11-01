import { useState } from "react";
import type { Settings } from "../../../shared/ctdp";
import { dispatch } from "../hooks/useCtdp";

export function SettingsPage({ settings }: { settings: Settings }) {
  const [draft, setDraft] = useState(settings);
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  };
  const save = async () => {
    await dispatch({ type: "updateSettings", patch: draft });
    setSaved(true);
  };

  return (
    <section className="card">
      <h2>设置</h2>
      <label className="field">
        <span>神圣座位的触发动作</span>
        <input value={draft.seatTrigger} onChange={(e) => set("seatTrigger", e.target.value)} />
      </label>
      <label className="field">
        <span>预约信号</span>
        <input value={draft.reserveSignal} onChange={(e) => set("reserveSignal", e.target.value)} />
      </label>
      <div className="grid2">
        <label className="field">
          <span>预约后落座时限（分钟）</span>
          <input
            type="number"
            min={1}
            max={120}
            value={draft.reserveWindowMin}
            onChange={(e) => set("reserveWindowMin", Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span>默认专注时长（分钟）</span>
          <input
            type="number"
            min={1}
            max={600}
            value={draft.defaultSessionMin}
            onChange={(e) => set("defaultSessionMin", Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span>预约快捷键</span>
          <input value={draft.reserveShortcut} onChange={(e) => set("reserveShortcut", e.target.value)} />
        </label>
        <label className="field">
          <span>落座快捷键</span>
          <input value={draft.startShortcut} onChange={(e) => set("startShortcut", e.target.value)} />
        </label>
      </div>
      <p className="hint">快捷键格式如 CommandOrControl+Alt+R；被其他程序占用时不会生效。</p>
      <label className="check">
        <input type="checkbox" checked={draft.showMiniWindow} onChange={(e) => set("showMiniWindow", e.target.checked)} />
        预约和专注时显示置顶悬浮窗
      </label>
      <div className="row">
        <button className="primary" onClick={() => void save()}>
          保存
        </button>
        {saved && <span className="notice ok inline">已保存</span>}
      </div>
    </section>
  );
}
