import { useEffect, useRef } from "react";

/** Single-key shortcuts, keyed by KeyboardEvent.key ("g", "Escape", "ArrowUp", "+"). */
export type KeyMap = Record<string, (() => void) | false | null | undefined>;

/** Typing in a field, or a dialog on screen, owns the keyboard. */
export function keyboardTaken(e: KeyboardEvent, inDialog: boolean): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  const t = e.target as HTMLElement | null;
  if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return true;
  // Enter and Space already press a focused button.
  if (t?.tagName === "BUTTON" && (e.key === "Enter" || e.key === " ")) return true;
  return !inDialog && Boolean(document.querySelector(".overlay, .dim"));
}

/**
 * Listens for single-key shortcuts while mounted. Letters match either case.
 * A falsy entry is a shortcut that is not available right now. A dialog
 * passes `inDialog` so its own keys work while it is the one on screen.
 */
export function useKeys(map: KeyMap, { inDialog = false } = {}): void {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat && !e.key.startsWith("Arrow")) return;
      if (keyboardTaken(e, inDialog)) return;
      const run = ref.current[e.key] ?? ref.current[e.key.toLowerCase()];
      if (!run) return;
      e.preventDefault();
      run();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inDialog]);
}
