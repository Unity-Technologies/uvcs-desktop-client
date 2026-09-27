import { Pencil } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { hotkey } from '../../lib/shortcutRegistry';
import { useCommands, type Command } from './commandStore';

/**
 * F2 renames the one item selected in a view's list (`target`, undefined unless exactly one is), as in Windows
 * Explorer and Linux file managers; the Finder's Return opens here.
 */
export function useRenameCommand<T>(group: string, noun: string, target: T | undefined, rename: (target: T) => void): void {
  const latestRename = useRef(rename);
  latestRename.current = rename;

  useCommands(
    useMemo<Command[]>(
      () => [
        {
          id: `${group.toLowerCase()}.rename`,
          group,
          label: `Rename selected ${noun}…`,
          icon: Pencil,
          shortcut: hotkey('rename'),
          disabled: target === undefined,
          run: () => target !== undefined && latestRename.current(target),
        },
      ],
      [group, noun, target],
    ),
  );
}
