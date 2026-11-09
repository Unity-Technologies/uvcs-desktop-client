import { useEffect } from 'react';
import { windowShortcutMayRun } from '../../lib/modalDialog';
import { matchesShortcut } from '../../lib/shortcuts';
import { isTextEntry } from '../../lib/textEntry';
import { useCommandPalette } from './commandPaletteStore';
import { allCommands } from './commandStore';
import { belongsToField, copiesSelectedText, yieldsToCommentField } from './typingKeys';
import { inCommentField } from '../../components/commentEditor/commentFieldScope';

/** The element typed into, also inside a shadow root (the diff's editor), where `event.target` is its host. */
function isTyping(event: KeyboardEvent): boolean {
  return isTextEntry(event.composedPath()[0]);
}

/**
 * Runs registered commands when their shortcut is pressed, never behind a modal dialog; one pressed in the palette
 * closes it first. Keys that belong to a field typed into are left to it, keys something already took (Esc
 * closing a menu) to that, and ⌘C with text selected on the page to copying it.
 */
export function CommandShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || (isTyping(event) && belongsToField(event)) || !windowShortcutMayRun(event)) return;
      // A comment field's own keys win inside it (⇧⌘U makes a link there, never an update): `scope: 'commentField'`.
      if (yieldsToCommentField(event, inCommentField(event.target))) return;
      if (copiesSelectedText(event, window.getSelection()?.toString() ?? '')) return;

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
