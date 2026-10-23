import { Search } from 'lucide-react';
import { useMemo } from 'react';
import { useCommands, type Command } from '../../app/commands/commandStore';
import { GO_TO_FILE_SHORTCUT } from '../files/useFileCommands';

/**
 * The palette's "Go to file…" (⌘P) in a repository explored without a workspace, the command a workspace's Files
 * offers (`files.goTo`): none until Files knows the branch whose files it searches.
 */
export function useGoToFileCommand(goToFile: (() => void) | null): void {
  useCommands(
    useMemo<Command[]>(
      () => (goToFile ? [{ id: 'files.goTo', group: 'Files', label: 'Go to file…', icon: Search, shortcut: GO_TO_FILE_SHORTCUT, run: goToFile }] : []),
      [goToFile],
    ),
  );
}
