import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

/** Which on-screen view is active. Print always includes both. */
export type ViewMode = 'grid' | 'summary';

interface ViewContextValue {
  view: ViewMode;
  setView: (view: ViewMode) => void;
}

const ViewContext = createContext<ViewContextValue | null>(null);

export function ViewProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<ViewMode>('grid');
  return (
    <ViewContext.Provider value={{ view, setView }}>
      {children}
    </ViewContext.Provider>
  );
}

export function useView(): ViewContextValue {
  const context = useContext(ViewContext);
  if (!context) {
    throw new Error('useView must be used within a ViewProvider');
  }
  return context;
}
