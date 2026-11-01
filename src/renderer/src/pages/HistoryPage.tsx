import { chainOf, formatDateTime, levelMark, type CtdpState, type HistoryEntry } from "../../../shared/ctdp";

const LIMIT = 300;

function describe(e: HistoryEntry): { tone: string; text: string } {
  switch (e.kind) {
    case "kept":
      return { tone: "good", text: `Kept ${levelMark(e.level)}${e.number} · ${e.name}${e.task && e.task !== e.name ? ` · ${e.task}` : ""}` };
    case "mainLost":
      return { tone: "bad", text: `Main track lost at #${e.lengths[0]} · ${e.reason}` };
    case "auxKept":
      return { tone: "good", text: `Reservation kept · auxiliary #${e.number}` };
    case "auxBroken":
      return { tone: "bad", text: `Auxiliary track broken at #${e.length}` };
    case "precedent":
      return { tone: "neutral", text: `Precedent (${e.track}): ${e.behavior}` };
    case "primary":
      return { tone: "neutral", text: "Became the primary chain" };
  }
}

export function HistoryPage({ state }: { state: CtdpState }) {
  const entries = [...state.history].reverse().slice(0, LIMIT);
  const units = state.history.filter((e) => e.kind === "kept" && e.level === 1).length;
  return (
    <section className="card">
      <h2>History</h2>
      <p className="hint">{units} units kept in total. Failure is data: lost chains are for review, not punishment.</p>
      {entries.length === 0 ? (
        <p className="empty">Nothing yet.</p>
      ) : (
        <ul className="list">
          {entries.map((e) => {
            const { tone, text } = describe(e);
            return (
              <li key={e.id} className={`entry ${tone}`}>
                <span className="dot" />
                <span className="list-main">
                  {text}
                  <span className="list-sub">{chainOf(state, e.chainId)?.name ?? "Deleted chain"}</span>
                </span>
                <span className="list-meta">{formatDateTime(e.at)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
