import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

/** How shifts are colored: full color, or black-and-white for clean prints. */
export type DisplayMode = 'color' | 'mono';

const STORAGE_KEY = 'shift-scheduler:v1:display-mode';

function loadDisplayMode(): DisplayMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'mono' ? 'mono' : 'color';
  } catch {
    return 'color';
  }
}

interface DisplayModeContextValue {
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
}

const DisplayModeContext = createContext<DisplayModeContextValue | null>(null);

/** Owns the color/black-and-white preference and persists it across reloads. */
export function DisplayModeProvider({ children }: { children: ReactNode }) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>(loadDisplayMode);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, displayMode);
    } catch {
      // Storage unavailable — the preference just won't persist. Not fatal.
    }
  }, [displayMode]);

  return (
    <DisplayModeContext.Provider value={{ displayMode, setDisplayMode }}>
      {children}
    </DisplayModeContext.Provider>
  );
}

export function useDisplayMode(): DisplayModeContextValue {
  const context = useContext(DisplayModeContext);
  if (!context) {
    throw new Error('useDisplayMode must be used within a DisplayModeProvider');
  }
  return context;
}
