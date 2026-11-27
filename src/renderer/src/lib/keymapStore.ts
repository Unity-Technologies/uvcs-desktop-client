import { create } from 'zustand';
import { keymapOf, type CustomShortcuts, type Keymap } from '@shared/shortcuts/keymap';
import { isMac } from './platform';

interface KeymapStore {
  keymap: Keymap;
  /** The custom shortcuts it was made from, as JSON: settings that change elsewhere leave it as it is. */
  madeFrom: string;
}

/**
 * The keys every shortcut takes in this window: the registry's, with the ones a person changed in Settings ▸ Keyboard
 * (`keymapOf`). `hotkey()` reads it; what holds a key it read renders again when it changes (`useKeymap`).
 */
export const useKeymapStore = create<KeymapStore>(() => ({ keymap: keymapOf({}, isMac), madeFrom: '{}' }));

export function setCustomShortcuts(custom: CustomShortcuts): void {
  const madeFrom = JSON.stringify(custom);
  if (madeFrom === useKeymapStore.getState().madeFrom) return;
  useKeymapStore.setState({ keymap: keymapOf(custom, isMac), madeFrom });
}

/**
 * The keymap, rendering the caller again when a person changes a shortcut: a component or hook that keeps a key it
 * read (a memo, a binding) takes the new one. docs/features/keyboard-shortcuts.md "Keys follow a change at once".
 */
export function useKeymap(): Keymap {
  return useKeymapStore((state) => state.keymap);
}
