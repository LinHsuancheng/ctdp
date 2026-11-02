import { useState } from "react";

export interface JsonPreview {
  errors: string[];
  /** One line per change, e.g. “Add chunk Morning block”. */
  changes: string[];
}

interface Props {
  title: string;
  hint: string;
  example: unknown;
  current: () => unknown;
  preview: (text: string) => JsonPreview;
  apply: (text: string) => Promise<void>;
}

/** Paste JSON (written by you or an agent), see exactly what it changes, then apply. */
export function JsonBox({ title, hint, example, current, preview, apply }: Props) {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState<number | null>(null);
  const result = text.trim() ? preview(text) : null;
  const ok = result && !result.errors.length && result.changes.length > 0;

  const copy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(current(), null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  const run = async () => {
    const n = result!.changes.length;
    await apply(text);
    setText("");
    setApplied(n);
  };

  return (
    <details className="disclosure json-box">
      <summary>{title}</summary>
      <div className="disclosure-body">
        <p className="hint">{hint}</p>
        <textarea
          className="json-text"
          rows={8}
          spellCheck={false}
          value={text}
          placeholder={JSON.stringify(example, null, 2)}
          onChange={(e) => {
            setText(e.target.value);
            setApplied(null);
          }}
        />
        {result?.errors.length ? (
          <ul className="json-errors">
            {result.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        ) : result ? (
          result.changes.length ? (
            <ul className="json-changes">
              {result.changes.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          ) : (
            <p className="hint">Nothing would change.</p>
          )
        ) : null}
        <div className="row">
          <button className="primary" disabled={!ok} onClick={() => void run()}>
            Apply{ok ? ` ${result.changes.length} change${result.changes.length === 1 ? "" : "s"}` : ""}
          </button>
          <button className="ghost small" onClick={() => void copy()}>
            {copied ? "Copied" : "Copy current as JSON"}
          </button>
          {applied !== null && <span className="notice ok inline">Applied {applied}</span>}
        </div>
      </div>
    </details>
  );
}
