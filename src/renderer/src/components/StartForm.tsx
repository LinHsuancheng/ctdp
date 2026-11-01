import { useState } from "react";
import { LEVEL_NAMES, levelMark, type Chain, type CtdpState } from "../../../shared/ctdp";
import { dispatch } from "../hooks/useCtdp";

const ADHOC = "";

export function StartForm({ state, chain }: { state: CtdpState; chain: Chain }) {
  const [chunkId, setChunkId] = useState(state.settings.quickStartChunkId ?? ADHOC);
  const [task, setTask] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [categoryId, setCategoryId] = useState<string | null>(state.categories[0]?.id ?? null);
  const chunk = state.chunks.find((c) => c.id === chunkId);
  const isPrimary = chain.id === state.primaryChainId;

  const sit = () =>
    void dispatch({ type: "seat", chainId: chain.id, chunkId: chunk ? chunk.id : null, task, minutes, categoryId });

  return (
    <section className="card">
      <h2>Sit down</h2>
      <p className="hint">
        Trigger: <strong>{chain.trigger}</strong>. Once seated, a virtual node is added; give it your best until you keep it.
      </p>
      <label className="field">
        <span>Chunk</span>
        <select value={chunkId} onChange={(e) => setChunkId(e.target.value)}>
          <option value={ADHOC}>Ad-hoc unit</option>
          {state.chunks.map((c) => (
            <option key={c.id} value={c.id}>
              {levelMark(c.level)} {c.name} · {LEVEL_NAMES[c.level]}
              {c.level === 1 ? ` · min ${c.minMinutes} min` : ` · ${c.children.length} parts`}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>What is this for?</span>
        <input value={task} maxLength={80} placeholder="e.g. Chapter 3 draft" onChange={(e) => setTask(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sit()} />
      </label>
      {!chunk && (
        <div className="grid2">
          <label className="field">
            <span>Minimum minutes</span>
            <input type="number" min={1} max={600} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
          </label>
          <label className="field">
            <span>Category</span>
            <select value={categoryId ?? ""} onChange={(e) => setCategoryId(e.target.value || null)}>
              <option value="">None</option>
              {state.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <button className="primary" onClick={sit}>
        Sit down
        {isPrimary && <span className="kbd">{state.settings.startShortcut}</span>}
      </button>
    </section>
  );
}
