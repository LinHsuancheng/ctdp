import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { keyboardTaken } from "../../hooks/useKeys";
import { Key } from "../Key";

interface Props {
  label: string;
  onHeld: () => void;
  ms?: number;
  className?: string;
  /** A letter that can be held anywhere on the screen instead of the button. */
  hotkey?: string;
  /** Set when the button sits in the dialog on screen, so its hotkey still works. */
  inDialog?: boolean;
}

/** Fires only after being held down for `ms`, so a stray click can never trigger it. */
export function HoldButton({ label, onHeld, ms = 2000, className = "ghost danger", hotkey, inDialog = false }: Props) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const held = useRef(onHeld);
  held.current = onHeld;
  const stop = () => {
    window.clearTimeout(timer.current);
    setHolding(false);
  };
  const start = () => {
    window.clearTimeout(timer.current);
    setHolding(true);
    timer.current = window.setTimeout(() => {
      setHolding(false);
      held.current();
    }, ms);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // Holding the hotkey works like holding the button; letting go early cancels.
  useEffect(() => {
    if (!hotkey) return;
    const down = (e: globalThis.KeyboardEvent) => {
      if (e.repeat || e.key.toLowerCase() !== hotkey || keyboardTaken(e, inDialog)) return;
      e.preventDefault();
      start();
    };
    const up = (e: globalThis.KeyboardEvent) => e.key.toLowerCase() === hotkey && stop();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
    // start and stop only touch refs and state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotkey, inDialog, ms]);

  const onPointerDown = (e: PointerEvent) => {
    e.preventDefault();
    start();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
      e.preventDefault();
      start();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => (e.key === "Enter" || e.key === " ") && stop();

  return (
    <button
      type="button"
      data-hold={label}
      className={`hold ${className}${holding ? " holding" : ""}`}
      style={{ "--hold-ms": `${ms}ms` } as CSSProperties}
      title="Press and hold"
      onPointerDown={onPointerDown}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onClick={(e) => e.preventDefault()}
    >
      <span className="hold-fill" />
      <span className="hold-label">
        {holding ? "Keep holding…" : label}
        {hotkey && <Key k={`hold ${hotkey.toUpperCase()}`} />}
      </span>
    </button>
  );
}
