import { useEffect } from 'react';
import { windowShortcutMayRun } from '../../lib/modalDialog';
import { matchesShortcut } from '../../lib/shortcuts';
import { useCommandPalette } from './commandPaletteStore';
import { allCommands } from './commandStore';

/** The element typed into, also inside a shadow root (the diff's editor), where `event.target` is its host. */
function isTyping(event: KeyboardEvent): boolean {
  const target = event.composedPath()[0];
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

/**
 * Runs registered commands when their shortcut is pressed, never behind a modal dialog; one pressed in the palette
 * closes it first. Plain-key shortcuts are ignored while typing.
 */
export function CommandShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const usesModifier = event.metaKey || event.ctrlKey || event.altKey;
      if ((!usesModifier && isTyping(event)) || !windowShortcutMayRun(event)) return;

      const command = allCommands().find((candidate) => candidate.shortcut && !candidate.disabled && matchesShortcut(event, candidate.shortcut));
      if (!command) return;
      event.preventDefault();
      useCommandPalette.getState().setOpen(false);
      command.run();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return null;
}
