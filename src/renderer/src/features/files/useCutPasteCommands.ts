import { X } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import type { TreeItem } from '@shared/domain/explorer';
import { useCommands, type Command } from '../../app/commands/commandStore';
import { pluralize } from '../../lib/text';
import { useCutItems, useCutItemsStore } from './cutItemsStore';
import { cutAction, CUT_PASTE_SHORTCUTS, pasteAction } from './cutPasteActions';

/**
 * ⌘X, ⌘V and Esc in the Files view, and their palette commands. Paste runs wherever something is cut, so a folder it
 * can't go into says why; Esc cancels only while something is cut, and never over a menu, dialog or field. Opening
 * another workspace cancels the cut: its paths mean nothing there.
 */
export function useCutPasteCommands(workspacePath: string, selected: readonly TreeItem[]): void {
  const cut = useCutItems(workspacePath);
  useEffect(() => {
    const store = useCutItemsStore.getState();
    if (store.workspacePath !== null && store.workspacePath !== workspacePath) store.clear();
  }, [workspacePath]);
  const commands = useMemo<Command[]>(() => {
    const paste = pasteAction(workspacePath, selected);
    return [
      { ...cutAction(workspacePath, selected), id: 'files.cut', group: 'Files', label: 'Cut selected items to move them' },
      {
        ...paste,
        id: 'files.paste',
        group: 'Files',
        label: `Paste ${pluralize(cut.length, 'cut item')} into the selected folder`,
        disabled: cut.length === 0,
      },
      {
        id: 'files.cancelCut',
        group: 'Files',
        label: 'Cancel the cut',
        icon: X,
        shortcut: CUT_PASTE_SHORTCUTS.cancel,
        disabled: cut.length === 0,
        run: () => useCutItemsStore.getState().clear(),
      },
    ];
  }, [workspacePath, selected, cut]);

  useCommands(commands);
}
