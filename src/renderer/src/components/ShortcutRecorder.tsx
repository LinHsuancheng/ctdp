import { useEffect, useState, type KeyboardEvent } from "react";
import { DEFAULT_SUMMON } from "../../../shared/ctdp";
import type { ShortcutStatus } from "../../../shared/ipc";

const NAMED: Record<string, string> = {
  Space: "Space",
  Enter: "Enter",
  Tab: "Tab",
  Backspace: "Backspace",
  Delete: "Delete",
  Insert: "Insert",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Minus: "-",
  Equal: "=",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Semicolon: ";",
  Quote: "'",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Backquote: "`",
};

/** The pressed key as an Electron accelerator key, from the physical key so layouts and Shift don't change it. */
function keyOf(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1\d|2[0-4])$/.test(code)) return code;
  if (/^Numpad\d$/.test(code)) return `num${code.slice(6)}`;
  return NAMED[code] ?? null;
}

/** Builds an accelerator from a key press; null while only modifiers are down or when nothing usable was pressed. */
export function acceleratorOf(e: { code: string; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean }): string | null {
  const key = keyOf(e.code);
  if (!key) return null;
  const mods = [e.ctrlKey && "Control", e.altKey && "Alt", e.shiftKey && "Shift", e.metaKey && "Super"].filter(Boolean) as string[];
  // A plain letter would fire while typing anywhere; function keys alone are fine.
  if (!mods.length && !/^F\d+$/.test(key)) return null;
  if (mods.length === 1 && mods[0] === "Shift" && !/^F\d+$/.test(key)) return null;
  return [...mods, key].join("+");
}

const Keys = ({ accelerator }: { accelerator: string }) => (
  <span className="keys">
    {accelerator.split("+").map((k, i) => (
      <span key={i} className="key">
        {k}
      </span>
    ))}
  </span>
);

/** Click Change, press the combination you want; it is checked on the spot and saved only if it works. */
export function ShortcutRecorder({ value }: { value: string }) {
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState<ShortcutStatus | null>(null);
  const [tried, setTried] = useState<ShortcutStatus | null>(null);

  useEffect(() => {
    void window.ctdp.shortcutStatus().then(setStatus);
  }, [value]);

  const save = async (accelerator: string) => {
    const result = await window.ctdp.testShortcut(accelerator);
    setTried(result);
    if (!result.ok) return;
    setRecording(false);
    await window.ctdp.updateSettings({ summonShortcut: accelerator });
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (!recording) return;
    e.preventDefault();
    // The keys being recorded are not shortcuts for the page.
    e.stopPropagation();
    if (e.key === "Escape") return setRecording(false);
    const accelerator = acceleratorOf(e);
    if (accelerator) void save(accelerator);
  };

  return (
    <div className="field">
      <span>Shortcut to bring up CTDP from anywhere</span>
      <div className={recording ? "recorder recording" : "recorder"} tabIndex={-1} onKeyDown={onKeyDown}>
        <Keys accelerator={value} />
        {recording ? (
          <button className="secondary small" autoFocus onBlur={() => setRecording(false)}>
            Press the keys… (Esc to cancel)
          </button>
        ) : (
          <button
            className="secondary small"
            onClick={() => {
              setTried(null);
              setRecording(true);
            }}
          >
            Change
          </button>
        )}
        {value !== DEFAULT_SUMMON && !recording && (
          <button className="ghost small" onClick={() => void save(DEFAULT_SUMMON)}>
            Reset to {DEFAULT_SUMMON}
          </button>
        )}
      </div>
      {tried && !tried.ok ? (
        <span className="status-bad">
          {tried.accelerator}: {tried.message}. Try another combination.
        </span>
      ) : status ? (
        <span className={status.ok ? "status-ok" : "status-bad"}>{status.ok ? "✓ Works" : `✗ ${status.message} — choose another`}</span>
      ) : null}
      <span className="hint">Use Ctrl, Alt or Shift together with a letter, a number or a function key.</span>
    </div>
  );
}
