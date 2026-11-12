import { Search } from 'lucide-react';
import { useMemo } from 'react';
import { useCommands, type Command } from '../../app/commands/commandStore';
import { GO_TO_FILE_SHORTCUT } from '../files/useFileCommands';

/**
 * The palette's "Go to file…" (⌘P) in a repository's Files explored without a workspace and in Browse repository, the
 * command a workspace's Files offers (`files.goTo`): it brings the keyboard to the tree's search, and is offered only
 * once the changeset whose tree it searches is known.
 */
export function useGoToFileCommand(goToFile: (() => void) | null): void {
  useCommands(
    useMemo<Command[]>(
      () => (goToFile ? [{ id: 'files.goTo', group: 'Files', label: 'Go to file…', icon: Search, shortcut: GO_TO_FILE_SHORTCUT, run: goToFile }] : []),
      [goToFile],
    ),
  );
}
