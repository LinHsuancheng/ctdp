import { useEffect } from "react";
import { Key } from "../Key";

interface Props {
  kicker: string;
  text: string;
  sub?: string;
  doneLabel: string;
  onDone: () => void;
  onCancel: () => void;
}

/** The window goes dark and shows one requirement; nothing else competes for attention. */
export function DimPrompt({ kicker, text, sub, doneLabel, onDone, onCancel }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div className="dim" role="dialog" aria-modal="true" aria-label={kicker}>
      <div className="dim-inner">
        <span className="dim-kicker">{kicker}</span>
        <p className="dim-text">{text}</p>
        {sub && <p className="dim-sub">{sub}</p>}
        <div className="dim-actions">
          <button className="ghost" onClick={onCancel}>
            Cancel <Key k="Esc" />
          </button>
          <button className="primary" autoFocus onClick={onDone}>
            {doneLabel} <Key k="Enter" />
          </button>
        </div>
      </div>
    </div>
  );
}
