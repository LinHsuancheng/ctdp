import type { ReactNode } from "react";
import { Modal } from "../Modal";

interface Props {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** The last stop before something that cannot be undone. Cancel is the default. */
export function ConfirmDialog({ title, children, confirmLabel, onConfirm, onCancel }: Props) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="hint">{children}</div>
      <div className="row">
        <button className="secondary" autoFocus onClick={onCancel}>
          Cancel
        </button>
        <button className="danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
