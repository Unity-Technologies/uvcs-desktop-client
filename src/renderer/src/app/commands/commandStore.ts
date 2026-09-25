import { useEffect, useId } from 'react';
import { create } from 'zustand';
import type { Action } from '../../lib/actions';

export interface Command extends Action {
  /** Groups commands in the palette, e.g. "Go to", "Branch", "Workspace". */
  group: string;
  keywords?: string[];
}

interface CommandStore {
  commandsByOwner: Map<string, Command[]>;
  register: (owner: string, commands: Command[]) => void;
  unregister: (owner: string) => void;
}

export const useCommandStore = create<CommandStore>((set) => ({
  commandsByOwner: new Map(),
  register: (owner, commands) =>
    set((state) => ({ commandsByOwner: new Map(state.commandsByOwner).set(owner, commands) })),
  unregister: (owner) =>
    set((state) => {
      const commandsByOwner = new Map(state.commandsByOwner);
      commandsByOwner.delete(owner);
      return { commandsByOwner };
    }),
}));

export function allCommands(): Command[] {
  return [...useCommandStore.getState().commandsByOwner.values()].flat();
}

/**
 * Makes commands available in the palette (and their shortcuts active) while the calling component is mounted.
 * Pass a memoized array; commands are re-registered whenever it changes.
 */
export function useCommands(commands: Command[]): void {
  const owner = useId();
  const { register, unregister } = useCommandStore.getState();

  useEffect(() => {
    register(owner, commands);
  }, [owner, commands, register]);

  useEffect(() => () => unregister(owner), [owner, unregister]);
}
