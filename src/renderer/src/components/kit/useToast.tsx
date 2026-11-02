import { useCallback, useEffect, useRef, useState } from "react";

/** A short message at the bottom of the window that goes away by itself. */
export function useToast(ms = 2200) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback(
    (text: string) => {
      window.clearTimeout(timer.current);
      setMessage(text);
      timer.current = window.setTimeout(() => setMessage(null), ms);
    },
    [ms],
  );
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const node = message ? (
    <div className="toast" role="status">
      {message}
    </div>
  ) : null;
  return { show, node };
}
