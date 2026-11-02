import { useState } from "react";
import { findPrecedent, relatedPrecedents, type Precedent, type Verdict } from "../../../shared/ctdp";
import { Modal } from "./Modal";

interface Props {
  title: string;
  intro: string;
  placeholder: string;
  precedents: Precedent[];
  breakLabel: string;
  onJudge: (verdict: Verdict, text: string) => void;
  onClose?: () => void;
}

/** 下必为例: judge on the spot — break the track, or allow this forever. */
export function PrecedentDialog({ title, intro, placeholder, precedents, breakLabel, onJudge, onClose }: Props) {
  const [text, setText] = useState("");
  const exact = findPrecedent(precedents, text);
  const related = relatedPrecedents(precedents, text).filter((p) => p !== exact);

  return (
    <Modal title={title} onClose={onClose ?? (() => {})}>
      <p className="hint">{intro}</p>
      <textarea autoFocus rows={2} maxLength={120} value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} />
      {exact && <p className="notice ok">Already allowed by precedent “{exact.behavior}”. Carry on.</p>}
      {related.length > 0 && (
        <div className="related">
          <span>Related precedents:</span>
          {related.map((p) => (
            <span key={p.id} className="tag">
              {p.behavior}
            </span>
          ))}
        </div>
      )}
      <div className="row">
        <button className="ghost danger" disabled={Boolean(exact)} onClick={() => onJudge("break", text)}>
          {breakLabel}
        </button>
        <button className="secondary" disabled={!text.trim()} onClick={() => onJudge("allow", text)}>
          {exact ? "Apply precedent" : "Allow forever"}
        </button>
        {onClose && (
          <button className="ghost" onClick={onClose}>
            Back
          </button>
        )}
      </div>
    </Modal>
  );
}
