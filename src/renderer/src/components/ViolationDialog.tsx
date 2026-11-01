import { useState } from "react";
import type { CtdpState, Verdict } from "../../../shared/ctdp";
import { findPrecedent, relatedPrecedents } from "../../../shared/ctdp";
import { dispatch } from "../hooks/useCtdp";

/** 下必为例：拿不准的行为当场判定，没有“这次算了”。 */
export function ViolationDialog({ state, onClose }: { state: CtdpState; onClose: () => void }) {
  const [behavior, setBehavior] = useState("");
  const exact = findPrecedent(state.precedents, behavior);
  const related = relatedPrecedents(state.precedents, behavior).filter((p) => p !== exact);
  const canJudge = behavior.trim() !== "" && !exact;

  const judge = (verdict: Verdict) => {
    void dispatch({ type: "violation", behavior, verdict });
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>下必为例</h2>
        <p className="hint">
          写下刚才拿不准的行为，然后当场判定：要么算违规，主链清零；要么永久允许，以后再发生也一律不算违规。
        </p>
        <textarea
          autoFocus
          rows={2}
          maxLength={120}
          value={behavior}
          placeholder="例如：起身倒水、看一眼手机消息"
          onChange={(e) => setBehavior(e.target.value)}
        />
        {exact && <p className="notice ok">已有判例允许「{exact.behavior}」，这不算违规，继续专注。</p>}
        {related.length > 0 && (
          <div className="related">
            <span>相关判例：</span>
            {related.map((p) => (
              <span key={p.id} className="tag">
                {p.behavior}
              </span>
            ))}
          </div>
        )}
        <div className="row">
          <button className="danger" disabled={!canJudge} onClick={() => judge("break")}>
            判定违规 · 主链 #{state.mainChain} 清零
          </button>
          <button className="secondary" disabled={!canJudge} onClick={() => judge("allow")}>
            永久允许 · 以后都允许
          </button>
          <button className="ghost" onClick={onClose}>
            返回
          </button>
        </div>
      </div>
    </div>
  );
}
