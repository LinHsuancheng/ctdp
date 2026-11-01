import type { CtdpState } from "../../../shared/ctdp";
import { formatDateTime } from "../../../shared/ctdp";
import { dispatch } from "../hooks/useCtdp";

export function PrecedentsPage({ state }: { state: CtdpState }) {
  const remove = (id: string, behavior: string) => {
    if (confirm(`删除后「${behavior}」以后会算违规（规则变严）。确定吗？`)) {
      void dispatch({ type: "removePrecedent", id });
    }
  };

  return (
    <section className="card">
      <h2>判例表</h2>
      <p className="hint">
        这里是所有被“永久允许”的行为。每一条都是一次通融留下的代价：允许过一次，以后就一直允许。
      </p>
      {state.precedents.length === 0 ? (
        <p className="empty">还没有判例。专注中遇到拿不准的行为时，点“疑似违规…”来判定。</p>
      ) : (
        <ul className="list">
          {[...state.precedents].reverse().map((p) => (
            <li key={p.id}>
              <span className="list-main">{p.behavior}</span>
              <span className="list-meta">{formatDateTime(p.createdAt)}</span>
              <button className="ghost small" onClick={() => remove(p.id, p.behavior)}>
                删除
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
