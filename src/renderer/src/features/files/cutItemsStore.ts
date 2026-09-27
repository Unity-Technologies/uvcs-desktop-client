import { create } from 'zustand';
import type { TreeItem } from '@shared/domain/explorer';
import { isWorkspaceRoot } from './workspaceRoot';

export type CutItem = Pick<TreeItem, 'path' | 'name' | 'itemType' | 'isPrivate'>;

interface CutItemsStore {
  /** The workspace the items were cut in: another one shows none. */
  workspacePath: string | null;
  items: readonly CutItem[];
  cut: (workspacePath: string, items: readonly CutItem[]) => void;
  clear: () => void;
}

const NONE: readonly CutItem[] = [];

/**
 * Items cut in the Files view, to move into another folder once pasted. Cutting again replaces them; they stay cut
 * while the tree scrolls, collapses or the window shows other views, until pasted, cancelled (Esc) or another
 * workspace opens. Items inside a cut folder move with it, so only the folder is kept; the root can't move.
 */
export const useCutItemsStore = create<CutItemsStore>((set) => ({
  workspacePath: null,
  items: NONE,
  cut: (workspacePath, items) => set({ workspacePath, items: outermost(items.filter((item) => !isWorkspaceRoot(item))) }),
  clear: () => set({ workspacePath: null, items: NONE }),
}));

/** The items cut in this workspace. */
export function useCutItems(workspacePath: string): readonly CutItem[] {
  return useCutItemsStore((state) => (state.workspacePath === workspacePath ? state.items : NONE));
}

function outermost(items: readonly CutItem[]): CutItem[] {
  const folders = items.filter((item) => item.itemType === 'directory').map((item) => `${item.path}/`);
  return items.filter((item) => !folders.some((folder) => item.path.startsWith(folder)));
}
