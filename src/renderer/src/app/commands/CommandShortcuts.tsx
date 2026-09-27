import { useEffect } from 'react';
import { matchesShortcut } from '../../lib/shortcuts';
import { allCommands } from './commandStore';
import { belongsToField } from './typingKeys';

/** The element typed into, also inside a shadow root (the diff's editor), where `event.target` is its host. */
function isTyping(event: KeyboardEvent): boolean {
  const target = event.composedPath()[0];
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

/** Runs registered commands when their shortcut is pressed. Keys that belong to a field typed into are left to it. */
export function CommandShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isTyping(event) && belongsToField(event)) return;

      const command = allCommands().find((candidate) => candidate.shortcut && !candidate.disabled && matchesShortcut(event, candidate.shortcut));
      if (!command) return;
      event.preventDefault();
      command.run();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return null;
}
