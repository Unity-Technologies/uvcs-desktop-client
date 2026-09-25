import type { CommandLogEntry } from '@shared/events';
import { useEffect } from 'react';
import { create } from 'zustand';

const MAX_ENTRIES = 500;

/** Which commands the log shows: those of the open workspace, or every command the app ran. */
export type CommandLogScope = 'workspace' | 'all';

interface CommandLogStore {
  entries: CommandLogEntry[];
  open: boolean;
  scope: CommandLogScope;
  /** Entries up to this id were on screen in the log: failures after it are news. */
  seenUpTo: number;
  /** The entry the log was opened to show, highlighted and scrolled into view. */
  revealedId: number | null;
  /** Whether a screen that can show the log (the workspace screen) is up. */
  hosted: boolean;
  /** Failed entries an operation recognized and dealt with (e.g. a rejected checkin it retried): not news. */
  handledIds: ReadonlySet<number>;
  add: (entry: CommandLogEntry) => void;
  clear: () => void;
  toggle: () => void;
  reveal: (entryId: number) => void;
  setScope: (scope: CommandLogScope) => void;
  markHandled: (entryId: number) => void;
}

/** Every `cm` command the app runs, so power users can see (and copy) exactly what happened. */
export const useCommandLogStore = create<CommandLogStore>((set) => ({
  entries: [],
  open: false,
  scope: 'workspace',
  seenUpTo: 0,
  revealedId: null,
  hosted: false,
  handledIds: new Set(),
  add: (entry) => set((state) => ({ entries: [...state.entries.slice(-(MAX_ENTRIES - 1)), entry] })),
  clear: () => set({ entries: [] }),
  toggle: () => set((state) => ({ open: !state.open, revealedId: null, seenUpTo: state.entries.at(-1)?.id ?? state.seenUpTo })),
  reveal: (entryId) => set((state) => ({ open: true, revealedId: entryId, seenUpTo: state.entries.at(-1)?.id ?? state.seenUpTo })),
  setScope: (scope) => set({ scope }),
  markHandled: (entryId) => set((state) => ({ handledIds: new Set(state.handledIds).add(entryId) })),
}));

/** Lets "Show in command log" links appear while the calling screen is mounted. */
export function useCommandLogHost(): void {
  useEffect(() => {
    useCommandLogStore.setState({ hosted: true });
    return () => useCommandLogStore.setState({ hosted: false });
  }, []);
}

window.uvcs.on('commandLogged', (entry) => useCommandLogStore.getState().add(entry));
