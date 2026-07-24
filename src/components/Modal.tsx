import { useEffect, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** id of the element that titles the dialog (for aria-labelledby). */
  labelledBy: string;
  /** id of the element that describes the dialog (for aria-describedby). */
  describedBy?: string;
  /** Element to focus on open; defaults to the first focusable control inside. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Card sizing/layout classes; a default small card is used when omitted. */
  className?: string;
  children: ReactNode;
}

/**
 * A small, accessible modal shell — the shared in-app replacement for
 * window.confirm()/prompt(). Escape or a backdrop click closes; focus moves
 * inside on open, is trapped with Tab while open (so it honours `aria-modal`),
 * and returns to the trigger on close. `no-print`, so it never prints.
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  describedBy,
  initialFocusRef,
  className,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<Element | null>(null);
  // Whether the current click began with a mousedown on the backdrop itself —
  // so a text-selection drag that ends on the backdrop doesn't close the modal.
  const pressedBackdrop = useRef(false);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement;
    const target =
      initialFocusRef?.current ??
      dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Stop the Escape here so background layers (e.g. the paint bar) don't
        // also act on it — the modal is the topmost thing.
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      // Trap Tab within the dialog: aria-modal asserts the background is inert.
      const focusables = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement;
      if (
        event.shiftKey &&
        (active === first || !dialogRef.current.contains(active))
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    // Capture phase so the Tab trap and Escape win before other listeners.
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (restoreRef.current instanceof HTMLElement) restoreRef.current.focus();
    };
  }, [open, onClose, initialFocusRef]);

  if (!open) return null;

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      role="presentation"
      onMouseDown={(event) => {
        pressedBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        // Only a genuine click on the backdrop (press + release both on it) closes.
        if (event.target === event.currentTarget && pressedBackdrop.current) {
          onClose();
        }
        pressedBackdrop.current = false;
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={
          className ??
          'w-full max-w-sm rounded-sm border border-rule bg-paper p-5'
        }
      >
        {children}
      </div>
    </div>
  );
}
