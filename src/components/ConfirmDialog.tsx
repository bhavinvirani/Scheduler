import { useRef } from 'react';
import { Modal } from './Modal.tsx';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A confirmation modal — the in-app replacement for window.confirm(). Built on
 * the shared Modal shell; focus lands on Cancel so the safe choice is the
 * default. The destructive button stays ink (not `--alert`, which is reserved
 * for coverage/rule warnings).
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      labelledBy="confirm-dialog-title"
      describedBy="confirm-dialog-message"
      initialFocusRef={cancelRef}
    >
      <h2 id="confirm-dialog-title" className="text-base font-semibold">
        {title}
      </h2>
      <p id="confirm-dialog-message" className="mt-2 text-sm text-ink/70">
        {message}
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          ref={cancelRef}
          type="button"
          onClick={onCancel}
          className="rounded-sm border border-rule bg-paper px-3 py-1.5 text-sm font-medium text-ink hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/60"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-paper hover:bg-ink/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-ink/60"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
