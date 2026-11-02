import { useState } from "react";
import { applyLibrary, EXAMPLE_LIBRARY, LEVEL_NAMES, LEVELS, levelMark, libraryDoc, planLibrary, type Chunk, type ChunkInput, type CtdpState, type Level } from "../../../shared/ctdp";
import { JsonBox } from "../components/JsonBox";
import { dispatch } from "../hooks/useCtdp";

const blank: ChunkInput = { name: "", level: 1, categoryId: null, minMinutes: 60, freeAbandon: false, children: [], minChildren: 1 };

function describe(c: Chunk, state: CtdpState): string {
  if (c.level === 1) {
    const cat = state.categories.find((k) => k.id === c.categoryId)?.name ?? "No category";
    return `${cat} · min ${c.minMinutes} min${c.freeAbandon ? " · free abandon" : ""}`;
  }
  const names = c.children.map((id) => state.chunks.find((k) => k.id === id)?.name ?? "?");
  return `${names.join(" → ")} · keep after ${c.minChildren}/${c.children.length}`;
}

function ChunkForm({ state, initial, onSave, onCancel }: { state: CtdpState; initial: ChunkInput; onSave: (i: ChunkInput) => void; onCancel: () => void }) {
  const [input, setInput] = useState(initial);
  const [pick, setPick] = useState("");
  const set = <K extends keyof ChunkInput>(k: K, v: ChunkInput[K]) => setInput((i) => ({ ...i, [k]: v }));
  const candidates = state.chunks.filter((c) => c.level < input.level);
  const move = (i: number, d: number) =>
    setInput((cur) => {
      const children = [...cur.children];
      const j = i + d;
      if (j < 0 || j >= children.length) return cur;
      [children[i], children[j]] = [children[j], children[i]];
      return { ...cur, children };
    });
  const removeChild = (i: number) =>
    setInput((cur) => {
      const children = cur.children.filter((_, k) => k !== i);
      return { ...cur, children, minChildren: Math.min(cur.minChildren, Math.max(1, children.length)) };
    });
  const addChild = () => {
    if (!pick) return;
    setInput((cur) => ({ ...cur, children: [...cur.children, pick], minChildren: cur.children.length + 1 }));
  };
  const valid = input.name.trim() !== "" && (input.level === 1 || input.children.length > 0);

  return (
    <div className="form">
      <div className="grid2">
        <label className="field">
          <span>Name</span>
          <input value={input.name} onChange={(e) => set("name", e.target.value)} />
        </label>
        <label className="field">
          <span>Level</span>
          <select
            value={input.level}
            onChange={(e) => setInput((cur) => ({ ...cur, level: Number(e.target.value) as Level, children: [] }))}
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {levelMark(l)} {LEVEL_NAMES[l]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {input.level === 1 ? (
        <div className="grid2">
          <label className="field">
            <span>Category</span>
            <select value={input.categoryId ?? ""} onChange={(e) => set("categoryId", e.target.value || null)}>
              <option value="">None</option>
              {state.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Minimum minutes</span>
            <input type="number" min={1} max={600} value={input.minMinutes} onChange={(e) => set("minMinutes", Number(e.target.value))} />
          </label>
          <label className="check">
            <input type="checkbox" checked={input.freeAbandon} onChange={(e) => set("freeAbandon", e.target.checked)} />
            Can be abandoned without losing the chain (warm-up)
          </label>
        </div>
      ) : (
        <>
          <div className="field">
            <span>Parts, in order</span>
            <ol className="parts">
              {input.children.map((id, i) => {
                const c = state.chunks.find((k) => k.id === id);
                return (
                  <li key={i}>
                    <span className="list-main">
                      {c ? `${levelMark(c.level)} ${c.name}` : "?"}
                    </span>
                    <button className="ghost small" onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                    <button className="ghost small" onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                    <button className="ghost small danger" onClick={() => removeChild(i)} aria-label="Remove">×</button>
                  </li>
                );
              })}
            </ol>
            <div className="row">
              <select className="grow" value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">Add a part…</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {levelMark(c.level)} {c.name}
                  </option>
                ))}
              </select>
              <button className="secondary small" disabled={!pick} onClick={addChild}>
                Add
              </button>
            </div>
          </div>
          <label className="field">
            <span>Parts that must be kept before this chunk can be kept</span>
            <input
              type="number"
              min={1}
              max={Math.max(1, input.children.length)}
              value={input.minChildren}
              onChange={(e) => set("minChildren", Number(e.target.value))}
            />
          </label>
        </>
      )}
      <div className="row">
        <button className="primary" disabled={!valid} onClick={() => onSave(input)}>
          Save
        </button>
        <button className="ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function ChunksPage({ state }: { state: CtdpState }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const toInput = (c: Chunk): ChunkInput => ({ ...c });
  const save = (chunkId: string | null) => (input: ChunkInput) =>
    void dispatch({ type: "saveChunk", chunkId, input }).then(() => setEditing(null));
  const used = (c: Chunk) => state.chunks.some((p) => p.children.includes(c.id));

  const preview = (text: string) => {
    const plan = planLibrary(state, text);
    return {
      errors: plan.errors,
      changes: [...plan.newCategories.map((c) => `Add category ${c}`), ...plan.chunks.map((c) => `${c.update ? "Update" : "Add"} chunk ${c.name}`)],
    };
  };

  return (
    <>
      <JsonBox
        title="Add with JSON"
        hint="Paste categories and chunks as JSON — an agent can write it. Chunks refer to categories and to each other by name; a name that already exists is updated. Chains cannot be changed this way."
        example={EXAMPLE_LIBRARY}
        current={() => libraryDoc(state)}
        preview={preview}
        apply={(text) => applyLibrary(planLibrary(state, text), dispatch, () => window.ctdp.getState())}
      />
      <section className="card">
        <h2>Chunks</h2>
        <p className="hint">
          A chunk is a fixed set of nodes. A Unit is one sitting; higher levels are made of lower-level chunks in order. Starting
          a chunk adds virtual nodes at every level, which become real when kept.
        </p>
        {editing === "new" ? (
          <ChunkForm state={state} initial={blank} onSave={save(null)} onCancel={() => setEditing(null)} />
        ) : (
          <button className="secondary" onClick={() => setEditing("new")}>
            New chunk
          </button>
        )}
      </section>
      {LEVELS.map((level) => {
        const list = state.chunks.filter((c) => c.level === level);
        if (!list.length) return null;
        return (
          <section key={level} className="card">
            <h2>
              {levelMark(level)} {LEVEL_NAMES[level]}
            </h2>
            <ul className="list">
              {list.map((c) =>
                editing === c.id ? (
                  <li key={c.id} className="editing">
                    <ChunkForm state={state} initial={toInput(c)} onSave={save(c.id)} onCancel={() => setEditing(null)} />
                  </li>
                ) : (
                  <li key={c.id}>
                    <span className="list-main">
                      <strong>{c.name}</strong>
                      <span className="list-sub">{describe(c, state)}</span>
                    </span>
                    <button className="ghost small" onClick={() => setEditing(c.id)}>
                      Edit
                    </button>
                    <button
                      className="ghost small danger"
                      disabled={used(c)}
                      title={used(c) ? "Used by another chunk" : undefined}
                      onClick={() => confirm(`Delete ${c.name}?`) && void dispatch({ type: "deleteChunk", chunkId: c.id })}
                    >
                      Delete
                    </button>
                  </li>
                ),
              )}
            </ul>
          </section>
        );
      })}
    </>
  );
}
