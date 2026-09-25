import type { CommandLogEntry } from '@shared/events';
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
  add: (entry: CommandLogEntry) => void;
  clear: () => void;
  toggle: () => void;
  setScope: (scope: CommandLogScope) => void;
}

/** Every `cm` command the app runs, so power users can see (and copy) exactly what happened. */
export const useCommandLogStore = create<CommandLogStore>((set) => ({
  entries: [],
  open: false,
  scope: 'workspace',
  seenUpTo: 0,
  add: (entry) => set((state) => ({ entries: [...state.entries.slice(-(MAX_ENTRIES - 1)), entry] })),
  clear: () => set({ entries: [] }),
  toggle: () => set((state) => ({ open: !state.open, seenUpTo: state.entries.at(-1)?.id ?? state.seenUpTo })),
  setScope: (scope) => set({ scope }),
}));

window.uvcs.on('commandLogged', (entry) => useCommandLogStore.getState().add(entry));
