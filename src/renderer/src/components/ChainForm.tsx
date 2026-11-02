import { useState } from "react";
import type { ChainInput } from "../../../shared/ctdp";

export const blankChain: ChainInput = { name: "", trigger: "", signal: "Snap fingers once", windowMin: 15 };

export function ChainForm(props: { initial: ChainInput; saveLabel?: string; onSave: (i: ChainInput) => void; onCancel?: () => void }) {
  const { initial, onSave, onCancel } = props;
  const [input, setInput] = useState(initial);
  const set = <K extends keyof ChainInput>(k: K, v: ChainInput[K]) => setInput((i) => ({ ...i, [k]: v }));
  return (
    <div className="form">
      <div className="grid2">
        <label className="field">
          <span>Name</span>
          <input value={input.name} placeholder="e.g. Desk, Gym" onChange={(e) => set("name", e.target.value)} />
        </label>
        <label className="field">
          <span>Sacred seat trigger</span>
          <input value={input.trigger} placeholder="e.g. Put on the blue cap" onChange={(e) => set("trigger", e.target.value)} />
        </label>
        <label className="field">
          <span>Reserve signal</span>
          <input value={input.signal} onChange={(e) => set("signal", e.target.value)} />
        </label>
        <label className="field">
          <span>Reservation window (minutes)</span>
          <input type="number" min={1} max={120} value={input.windowMin} onChange={(e) => set("windowMin", Number(e.target.value))} />
        </label>
      </div>
      <div className="row">
        <button className="primary" disabled={!input.name.trim()} onClick={() => onSave(input)}>
          {props.saveLabel ?? "Save"}
        </button>
        {onCancel && (
          <button className="ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
