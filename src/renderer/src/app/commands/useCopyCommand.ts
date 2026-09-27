import { Copy } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { copyDefault, type CopyTexts } from '../../components/copyMenu';
import { hotkey } from '../../lib/shortcutRegistry';
import { useCommands, type Command } from './commandStore';

/**
 * ⌘C (Ctrl+C) copies the one object selected in a view's list (`texts`, undefined unless exactly one is) as the first
 * entry of its "Copy" submenu does: a branch's or label's name, a changeset's, shelve's or review's number. Text
 * selected on the page is copied instead, as anywhere (`CommandShortcuts`).
 */
export function useCopyCommand(group: string, noun: string, texts: CopyTexts | undefined): void {
  const latestTexts = useRef(texts);
  latestTexts.current = texts;
  const hasTexts = texts !== undefined;

  useCommands(
    useMemo<Command[]>(
      () => [
        {
          id: `${group.toLowerCase()}.copy`,
          group,
          label: `Copy selected ${noun.toLowerCase()}`,
          icon: Copy,
          shortcut: hotkey('listCopy'),
          disabled: !hasTexts,
          run: () => latestTexts.current && copyDefault(noun, latestTexts.current)?.(),
        },
      ],
      [group, noun, hasTexts],
    ),
  );
}
