import { useEffect } from 'react';

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** True when the event originated in a control that has its own undo semantics. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return EDITABLE_TAGS.has(target.tagName) || target.isContentEditable;
}

/**
 * Wire ⌘/Ctrl+Z (undo) and ⇧⌘/Ctrl+Z or Ctrl+Y (redo) to the schedule history.
 * Calls the same undo/redo the toolbar buttons use, so keyboard undos also flash
 * the changed cell. Yields to the browser's native text undo while a field is
 * focused. undo/redo no-op when there's nothing to do, so no guard is needed.
 */
export function useUndoRedoShortcuts(undo: () => void, redo: () => void): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (key === 'y') {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);
}
