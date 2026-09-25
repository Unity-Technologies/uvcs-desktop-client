import type { CommandLogEntry } from '@shared/events';
import { useEffect } from 'react';
import { create } from 'zustand';

const MAX_ENTRIES = 500;

interface CommandLogStore {
  entries: CommandLogEntry[];
  open: boolean;
  /** The entry the log was opened to show, highlighted and scrolled into view. */
  revealedId: number | null;
  /** Whether a screen that can show the log (the workspace screen) is up. */
  hosted: boolean;
  add: (entry: CommandLogEntry) => void;
  clear: () => void;
  toggle: () => void;
  reveal: (entryId: number) => void;
}

/** Every `cm` command the app runs, so power users can see (and copy) exactly what happened. */
export const useCommandLogStore = create<CommandLogStore>((set) => ({
  entries: [],
  open: false,
  revealedId: null,
  hosted: false,
  add: (entry) => set((state) => ({ entries: [...state.entries.slice(-(MAX_ENTRIES - 1)), entry] })),
  clear: () => set({ entries: [] }),
  toggle: () => set((state) => ({ open: !state.open, revealedId: null })),
  reveal: (entryId) => set({ open: true, revealedId: entryId }),
}));

/** Lets "Show in command log" links appear while the calling screen is mounted. */
export function useCommandLogHost(): void {
  useEffect(() => {
    useCommandLogStore.setState({ hosted: true });
    return () => useCommandLogStore.setState({ hosted: false });
  }, []);
}

window.uvcs.on('commandLogged', (entry) => useCommandLogStore.getState().add(entry));
