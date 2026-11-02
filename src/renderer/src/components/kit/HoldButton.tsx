import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";

interface Props {
  label: string;
  onHeld: () => void;
  ms?: number;
  className?: string;
}

/** Fires only after being held down for `ms`, so a stray click can never trigger it. */
export function HoldButton({ label, onHeld, ms = 2000, className = "ghost danger" }: Props) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const stop = () => {
    window.clearTimeout(timer.current);
    setHolding(false);
  };
  const start = () => {
    window.clearTimeout(timer.current);
    setHolding(true);
    timer.current = window.setTimeout(() => {
      setHolding(false);
      onHeld();
    }, ms);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

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
      <span className="hold-label">{holding ? "Keep holding…" : label}</span>
    </button>
  );
}
