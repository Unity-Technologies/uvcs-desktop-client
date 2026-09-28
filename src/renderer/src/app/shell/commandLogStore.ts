import type { CommandLogEntry } from '@shared/events';
import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { NO_FILTER, type CommandLogFilter } from './commandLogFilter';
import { EMPTY_LOG, withEntry } from './commandLogNumbering';
import type { CommandLogScope } from './commandLogScope';

const MAX_ENTRIES = 500;

/** The panel's height under the view; the view keeps `restMin` as the window gets shorter. */
export const COMMAND_LOG_HEIGHT = { initial: 220, min: 96, max: 1200, restMin: 200 };

interface CommandLogStore {
  entries: CommandLogEntry[];
  /** The number of the first entry: each keeps its own as older ones drop off (`NumberedLog`). */
  firstNumber: number;
  open: boolean;
  scope: CommandLogScope;
  /** For this session only, kept while the panel is closed. */
  filter: CommandLogFilter;
  /** Entries up to this id were on screen in the log: failures after it are news. */
  seenUpTo: number;
  /** The entry the log was opened to show, highlighted and scrolled into view. */
  revealedId: number | null;
  /** Whether a screen that can show the log (the workspace screen) is up. */
  hosted: boolean;
  /** Failed entries an operation recognized and dealt with (e.g. a rejected checkin it retried): not news. */
  handledIds: ReadonlySet<number>;
  /** Remembered across sessions, unlike the entries. */
  height: number;
  add: (entry: CommandLogEntry) => void;
  clear: () => void;
  toggle: () => void;
  reveal: (entryId: number) => void;
  setScope: (scope: CommandLogScope) => void;
  setFilter: (filter: Partial<CommandLogFilter>) => void;
  markHandled: (entryId: number) => void;
  setHeight: (height: number) => void;
}

/** Every `cm` command the app runs, so power users can see (and copy) exactly what happened. */
export const useCommandLogStore = create<CommandLogStore>()(
  persist(
    (set) => ({
      ...EMPTY_LOG,
      open: false,
      scope: 'workspace',
      filter: NO_FILTER,
      seenUpTo: 0,
      revealedId: null,
      hosted: false,
      handledIds: new Set(),
      add: (entry) => set((state) => withEntry(state, entry, MAX_ENTRIES)),
      clear: () => set(EMPTY_LOG),
      toggle: () => set((state) => ({ open: !state.open, revealedId: null, seenUpTo: state.entries.at(-1)?.id ?? state.seenUpTo })),
      reveal: (entryId) => set((state) => ({ open: true, revealedId: entryId, seenUpTo: state.entries.at(-1)?.id ?? state.seenUpTo })),
      setScope: (scope) => set({ scope }),
      setFilter: (filter) => set((state) => ({ filter: { ...state.filter, ...filter } })),
      markHandled: (entryId) => set((state) => ({ handledIds: new Set(state.handledIds).add(entryId) })),
      height: COMMAND_LOG_HEIGHT.initial,
      setHeight: (height) => set({ height }),
    }),
    { name: 'command-log', partialize: ({ height }) => ({ height }) },
  ),
);

/** Lets "Show in command log" links appear while the calling screen is mounted. */
export function useCommandLogHost(): void {
  useEffect(() => {
    useCommandLogStore.setState({ hosted: true });
    return () => {
      useCommandLogStore.setState({ hosted: false });
    };
  }, []);
}

window.uvcs.on('commandLogged', (entry) => useCommandLogStore.getState().add(entry));
