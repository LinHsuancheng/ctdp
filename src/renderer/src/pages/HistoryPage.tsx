import type { CtdpState } from "../../../shared/ctdp";
import { formatDateTime } from "../../../shared/ctdp";

const LIMIT = 200;

interface Entry {
  id: string;
  at: number;
  kind: "session" | "main" | "reserve";
  text: string;
}

function entries(state: CtdpState): Entry[] {
  const sessions: Entry[] = state.sessions.map((s) => ({
    id: s.id,
    at: s.endedAt,
    kind: "session",
    text: `完成 #${s.chainNo} · ${s.task} · ${s.plannedMin} 分钟${s.reserved ? " · 预约守约" : ""}`,
  }));
  const breaks: Entry[] = state.breaks.map((b) => ({
    id: b.id,
    at: b.at,
    kind: b.kind,
    text: `${b.kind === "main" ? "主链" : "预约链"} #${b.chainLength} 断开 · ${b.reason}`,
  }));
  return [...sessions, ...breaks].sort((a, b) => b.at - a.at).slice(0, LIMIT);
}

export function HistoryPage({ state }: { state: CtdpState }) {
  const totalMin = state.sessions.reduce((sum, s) => sum + s.plannedMin, 0);
  const list = entries(state);

  return (
    <section className="card">
      <h2>记录</h2>
      <p className="hint">
        共完成 {state.sessions.length} 节，累计 {Math.round((totalMin / 60) * 10) / 10} 小时。失败即数据：断链记录用来复盘，不用来惩罚自己。
      </p>
      {list.length === 0 ? (
        <p className="empty">还没有记录。</p>
      ) : (
        <ul className="list">
          {list.map((e) => (
            <li key={e.id} className={`entry ${e.kind}`}>
              <span className="dot" />
              <span className="list-main">{e.text}</span>
              <span className="list-meta">{formatDateTime(e.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
