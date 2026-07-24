import { useRef, useState } from 'react';
import { useSchedule } from '../state/ScheduleContext.tsx';
import { encodeShare } from '../lib/shareCodec.ts';
import { Modal } from './Modal.tsx';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
}

/** The manager's "share this roster" dialog: a view-only link to copy. */
export function ShareModal({ open, onClose }: ShareModalProps) {
  const { schedule } = useSchedule();
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  // Build the link only while open — cheap, and avoids encoding on every render.
  const base = window.location.href.split('#')[0];
  const link = open ? `${base}#r=${encodeShare(schedule)}` : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (e.g. non-secure context) — select so they can copy manually.
      inputRef.current?.select();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="share-title"
      describedBy="share-desc"
      className="w-full max-w-lg rounded-sm border border-rule bg-paper p-5"
    >
      <h2 id="share-title" className="text-base font-semibold">
        Share this roster
      </h2>
      <p id="share-desc" className="mt-1 text-sm text-ink/60">
        Anyone with this link can{' '}
        <strong className="font-semibold">view</strong> and print the roster.
        They can't edit it, and nothing is uploaded or stored on a server. Paste
        it in your team chat.
      </p>

      <div className="mt-4 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          readOnly
          value={link}
          aria-label="Shareable view-only link"
          onFocus={(event) => event.target.select()}
          className="min-w-0 flex-1 rounded-sm border border-rule bg-paper px-2 py-1.5 font-mono text-xs text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink/50"
        />
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-paper hover:bg-ink/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-ink/60"
        >
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>

      <p className="mt-3 text-xs text-ink/50">
        The whole roster is encoded in the link itself, so it keeps working even
        if you change your own copy later.
      </p>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-sm border border-rule bg-paper px-3 py-1.5 text-sm font-medium text-ink hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/60"
        >
          Done
        </button>
      </div>
    </Modal>
  );
}
