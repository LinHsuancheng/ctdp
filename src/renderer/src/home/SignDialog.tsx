import { useState } from "react";
import { findPrecedent, type Chain, type Seat } from "../../../shared/ctdp";
import { ConfirmDialog } from "../components/kit/ConfirmDialog";
import { HoldButton } from "../components/kit/HoldButton";
import { Key } from "../components/Key";
import { Modal } from "../components/Modal";
import { useKeys } from "../hooks/useKeys";
import { dispatch } from "../hooks/useCtdp";

/** Text recorded for a self-reported violation: violations need no explanation. */
export const SELF_REPORTED = "Self-reported violation";

interface Props {
  chain: Chain;
  seat: Seat;
  onSigned: (number: number) => void;
  onClose: () => void;
}

/**
 * Finishing a unit is a self-signature: it states that nothing happened
 * beyond what this chain already allows. Anything new to allow is recorded
 * as a precedent first; a violation breaks the chain with no reason asked.
 */
export function SignDialog({ chain, seat, onSigned, onClose }: Props) {
  const [mode, setMode] = useState<"ask" | "allow">("ask");
  const [text, setText] = useState("");
  const [breaking, setBreaking] = useState(false);
  const { precedents } = chain.main;
  const exact = findPrecedent(precedents, text);
  const number = seat.node.number;

  const sign = async () => {
    await dispatch({ type: "finishUnit", keep: true });
    onSigned(number);
  };
  const allowAndSign = async () => {
    if (!exact) await dispatch({ type: "violation", behavior: text, verdict: "allow" });
    await sign();
  };
  const asking = mode === "ask" && !breaking;
  useKeys({ s: asking && (() => void sign()), a: asking && (() => setMode("allow")) }, { inDialog: true });

  if (breaking) {
    return (
      <ConfirmDialog
        title="Break the chain?"
        confirmLabel={`Break chain (#${chain.main.counters[0].current} → 0)`}
        onConfirm={() => void dispatch({ type: "violation", behavior: SELF_REPORTED, verdict: "break" })}
        onCancel={() => setBreaking(false)}
      >
        The whole {chain.name} main track is lost and starts again from #1. This cannot be undone.
      </ConfirmDialog>
    );
  }

  return (
    <Modal title={`#${number} done — sign it`} onClose={onClose}>
      <div className="sign-allowed">
        <span className="sign-label">Allowed on this chain so far</span>
        {precedents.length ? (
          <ul className="sign-list">
            {precedents.map((p) => (
              <li key={p.id}>{p.behavior}</li>
            ))}
          </ul>
        ) : (
          <p className="hint">Nothing yet — the strictest version of the rule.</p>
        )}
      </div>

      {mode === "ask" ? (
        <>
          <p className="sign-question">Did anything else happen?</p>
          <div className="sign-actions">
            <button className="primary" autoFocus onClick={() => void sign()}>
              Nothing else — sign <Key k="S" />
            </button>
            <button className="secondary" onClick={() => setMode("allow")}>
              Something to allow forever… <Key k="A" />
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="field">
            <span>What happened? From now on it is allowed on this chain, forever.</span>
            <textarea autoFocus rows={2} maxLength={120} value={text} placeholder="e.g. answered the door" onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (text.trim()) void allowAndSign();
                } else if (e.key === "Escape") {
                  // Back to the question, not out of the dialog.
                  e.stopPropagation();
                  setMode("ask");
                }
              }}
            />
          </label>
          {exact && <p className="notice ok">Already allowed by “{exact.behavior}”.</p>}
          <div className="sign-actions">
            <button className="primary" disabled={!text.trim()} onClick={() => void allowAndSign()}>
              {exact ? "Sign" : "Allow forever and sign"} <Key k="Enter" />
            </button>
            <button className="ghost" onClick={() => setMode("ask")}>
              Back <Key k="Esc" />
            </button>
          </div>
        </>
      )}

      <p className="sign-note">
        Signing says this sitting stayed within what is allowed above. Anything that goes unrecorded takes the meaning out of the whole chain.
      </p>
      <div className="sign-break">
        <HoldButton label="It was a violation — break chain" hotkey="b" inDialog onHeld={() => setBreaking(true)} />
      </div>
    </Modal>
  );
}
