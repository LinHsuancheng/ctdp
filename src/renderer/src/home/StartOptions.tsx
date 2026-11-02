import { useRef, type KeyboardEvent } from "react";
import { LEVEL_NAMES, levelMark, orderedChains, type CtdpState } from "../../../shared/ctdp";
import { Key } from "../components/Key";
import { useKeys } from "../hooks/useKeys";

export interface StartChoice {
  chainId: string;
  chunkId: string | null;
  minutes: number;
  categoryId: string | null;
  task: string;
}

/**
 * What Action will start, open by default: it repeats the last sitting on the
 * primary chain. C, K and T jump to the chain, the chunk and the task; arrows
 * change a list, Esc steps back out so the single-key shortcuts work again.
 */
export function StartOptions({ state, value, onChange }: { state: CtdpState; value: StartChoice; onChange: (v: StartChoice) => void }) {
  const set = <K extends keyof StartChoice>(key: K, v: StartChoice[K]) => onChange({ ...value, [key]: v });
  const chunk = state.chunks.find((c) => c.id === value.chunkId);
  const chains = orderedChains(state);
  const box = useRef<HTMLDetailsElement>(null);
  const focus = (name: string) => () => {
    if (box.current) box.current.open = true;
    box.current?.querySelector<HTMLElement>(`[name="${name}"]`)?.focus();
  };
  useKeys({ c: chains.length > 1 && focus("chain"), k: focus("chunk"), t: focus("task") });
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && e.target !== box.current) (e.target as HTMLElement).blur();
  };
  return (
    <details className="disclosure" open ref={box} onKeyDown={onKey}>
      <summary>Options</summary>
      <div className="disclosure-body">
        <div className="grid2">
          {chains.length > 1 && (
            <label className="field">
              <span>
                Chain <Key k="C" />
              </span>
              <select name="chain" value={value.chainId} onChange={(e) => set("chainId", e.target.value)}>
                {chains.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.id === state.primaryChainId ? " (primary)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            <span>
              Chunk <Key k="K" />
            </span>
            <select name="chunk" value={value.chunkId ?? ""} onChange={(e) => set("chunkId", e.target.value || null)}>
              <option value="">Ad-hoc unit</option>
              {state.chunks.map((c) => (
                <option key={c.id} value={c.id}>
                  {levelMark(c.level)} {c.name} · {LEVEL_NAMES[c.level]}
                  {c.level === 1 ? ` · ${c.minMinutes} min` : ` · ${c.children.length} parts`}
                </option>
              ))}
            </select>
          </label>
          {!chunk && (
            <>
              <label className="field">
                <span>Minimum minutes</span>
                <input type="number" min={1} max={600} value={value.minutes} onChange={(e) => set("minutes", Number(e.target.value))} />
              </label>
              <label className="field">
                <span>Category</span>
                <select value={value.categoryId ?? ""} onChange={(e) => set("categoryId", e.target.value || null)}>
                  <option value="">None</option>
                  {state.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>
        <label className="field">
          <span>
            What is it for? (optional) <Key k="T" />
          </span>
          <input name="task" value={value.task} maxLength={80} placeholder="e.g. Chapter 3 draft" onChange={(e) => set("task", e.target.value)} />
        </label>
      </div>
    </details>
  );
}
