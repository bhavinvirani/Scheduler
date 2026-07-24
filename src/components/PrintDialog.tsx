import { useRef } from 'react';
import { Modal } from './Modal.tsx';

interface PrintDialogProps {
  open: boolean;
  /** Called with the chosen scope: true = grid + hours page, false = grid only. */
  onChoose: (includeSummary: boolean) => void;
  onCancel: () => void;
}

const choiceButton =
  'w-full rounded-sm px-3 py-2.5 text-left text-sm font-medium ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-ink/60';

/**
 * Asked when the user hits Print / PDF: include just the schedule grid (one
 * page) or the grid plus the hours summary (two pages). The summary is the
 * fuller, current-default output, so it leads and takes initial focus.
 */
export function PrintDialog({ open, onChoose, onCancel }: PrintDialogProps) {
  const bothRef = useRef<HTMLButtonElement>(null);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      labelledBy="print-dialog-title"
      describedBy="print-dialog-desc"
      initialFocusRef={bothRef}
    >
      <h2 id="print-dialog-title" className="text-base font-semibold">
        Print / PDF
      </h2>
      <p id="print-dialog-desc" className="mt-2 text-sm text-ink/70">
        What should the PDF include?
      </p>

      <div className="mt-5 flex flex-col gap-2">
        <button
          ref={bothRef}
          type="button"
          onClick={() => onChoose(true)}
          className={`${choiceButton} bg-ink text-paper hover:bg-ink/85`}
        >
          Schedule + hours summary
          <span className="mt-0.5 block text-xs font-normal text-paper/70">
            Two pages: the grid, then the hours page.
          </span>
        </button>
        <button
          type="button"
          onClick={() => onChoose(false)}
          className={`${choiceButton} border border-rule bg-paper text-ink hover:bg-ink/5`}
        >
          Schedule only
          <span className="mt-0.5 block text-xs font-normal text-ink/60">
            One page: just the grid.
          </span>
        </button>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-sm px-3 py-1.5 text-sm font-medium text-ink/70 hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/60"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}
