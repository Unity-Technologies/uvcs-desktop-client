import type { TreeItem } from '@shared/domain/explorer';
import type { Action } from '../../lib/actions';
import type { GroupedEntry } from '../../lib/menuGroups';
import { hotkey } from '../../lib/shortcutRegistry';
import { menuAction } from '../../components/menuWords';
import { useCutItemsStore } from './cutItemsStore';
import { pasteCutItems, pastePlanFor } from './pasteItems';
import { isWorkspaceRoot } from './workspaceRoot';

export const CUT_PASTE_SHORTCUTS = {
  cut: hotkey('cutItems'),
  paste: hotkey('pasteItems'),
  cancel: hotkey('cancelCut'),
};

export function cutAction(workspacePath: string, items: readonly TreeItem[]): GroupedEntry & Action {
  return menuAction('cut', () => useCutItemsStore.getState().cut(workspacePath, items), {
    shortcut: CUT_PASTE_SHORTCUTS.cut,
    disabled: items.length === 0 || items.some(isWorkspaceRoot),
  });
}

/** Paste, disabled with the reason where the cut items can't go. */
export function pasteAction(workspacePath: string, items: readonly TreeItem[]): GroupedEntry & Action {
  const plan = pastePlanFor(workspacePath, items);
  return menuAction('paste', () => void pasteCutItems(workspacePath, items), {
    shortcut: CUT_PASTE_SHORTCUTS.paste,
    disabled: plan.kind === 'refused',
    disabledReason: plan.kind === 'refused' ? plan.reason : undefined,
  });
}
