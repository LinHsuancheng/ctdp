import { useEffect, type ReactNode } from "react";

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  // Esc always backs out of a dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (e.preventDefault(), onClose());
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
