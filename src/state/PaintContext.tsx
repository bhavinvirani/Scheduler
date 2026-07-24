import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

interface PaintContextValue {
  /** The preset id currently armed for one-click painting, or null. */
  armedPresetId: string | null;
  /** Arm a preset if not already armed; clicking the armed one again disarms. */
  toggle: (id: string) => void;
  disarm: () => void;
}

const PaintContext = createContext<PaintContextValue | null>(null);

/**
 * Session-only "paint" state: which preset is armed for one-click fill on the
 * desktop grid. Not persisted — arming is a transient editing mode, not a
 * document preference.
 */
export function PaintProvider({ children }: { children: ReactNode }) {
  const [armedPresetId, setArmedPresetId] = useState<string | null>(null);

  const value = useMemo<PaintContextValue>(
    () => ({
      armedPresetId,
      toggle: (id) =>
        setArmedPresetId((current) => (current === id ? null : id)),
      disarm: () => setArmedPresetId(null),
    }),
    [armedPresetId],
  );

  return (
    <PaintContext.Provider value={value}>{children}</PaintContext.Provider>
  );
}

export function usePaint(): PaintContextValue {
  const context = useContext(PaintContext);
  if (!context) {
    throw new Error('usePaint must be used within a PaintProvider');
  }
  return context;
}
