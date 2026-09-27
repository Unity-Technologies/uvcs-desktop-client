import { ClipboardPaste, Scissors } from 'lucide-react';
import type { TreeItem } from '@shared/domain/explorer';
import type { Action } from '../../lib/actions';
import { hotkey } from '../../lib/shortcutRegistry';
import { useCutItemsStore } from './cutItemsStore';
import { pasteCutItems, pastePlanFor } from './pasteItems';
import { isWorkspaceRoot } from './workspaceRoot';

export const CUT_PASTE_SHORTCUTS = {
  cut: hotkey('cutItems'),
  paste: hotkey('pasteItems'),
  cancel: hotkey('cancelCut'),
};

export function cutAction(workspacePath: string, items: readonly TreeItem[]): Action {
  return {
    id: 'cut',
    label: 'Cut',
    icon: Scissors,
    shortcut: CUT_PASTE_SHORTCUTS.cut,
    disabled: items.length === 0 || items.some(isWorkspaceRoot),
    run: () => useCutItemsStore.getState().cut(workspacePath, items),
  };
}

/** Paste, disabled with the reason where the cut items can't go. */
export function pasteAction(workspacePath: string, items: readonly TreeItem[]): Action {
  const plan = pastePlanFor(workspacePath, items);
  return {
    id: 'paste',
    label: 'Paste',
    icon: ClipboardPaste,
    shortcut: CUT_PASTE_SHORTCUTS.paste,
    disabled: plan.kind === 'refused',
    disabledReason: plan.kind === 'refused' ? plan.reason : undefined,
    run: () => void pasteCutItems(workspacePath, items),
  };
}

/** The file menu's clipboard group: Cut (not for the root) and Paste. */
export function cutPasteMenu(workspacePath: string, items: readonly TreeItem[]): Action[] {
  return [...(items.some(isWorkspaceRoot) ? [] : [cutAction(workspacePath, items)]), pasteAction(workspacePath, items)];
}
