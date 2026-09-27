import type { ItemMove, TreeItem } from '@shared/domain/explorer';
import type { CutItem } from './cutItemsStore';
import { parentOf } from './fileTreeRows';

/** The folder cut items would move into (`''` is the root), and whether it's private. */
export interface PasteTarget {
  path: string;
  isPrivate: boolean;
}

export type PastePlan =
  | { kind: 'refused'; reason: string }
  /** `clashes`: names the folder already has, left where they are unless the user cancels. */
  | { kind: 'ready'; target: string; moves: ItemMove[]; clashes: string[] };

/**
 * The folder a paste goes into: the selected folder, or the folder of the selected file; several items, the folder
 * they're all in. Null when they're in different folders.
 */
export function pasteFolderFor(selected: readonly Pick<TreeItem, 'path' | 'itemType'>[]): string | null {
  if (selected.length === 1) return selected[0]!.itemType === 'directory' ? selected[0]!.path : parentOf(selected[0]!.path);
  const folders = new Set(selected.map((item) => parentOf(item.path)));
  return folders.size === 1 ? [...folders][0]! : null;
}

/** `/docs`, `/` for the root: how the app names a folder in messages. */
export function folderLabel(path: string): string {
  return `/${path}`;
}

/**
 * What pasting the cut items into `target` does: the moves (items already in it stay), or why it can't. A folder
 * can't go into itself or a folder inside it, and controlled items can't go into a private folder (`cm` refuses);
 * names the folder has (in any case, as macOS and Windows compare them) are never replaced.
 */
export function planPaste(cut: readonly CutItem[], target: PasteTarget | null, namesInTarget: readonly string[]): PastePlan {
  if (cut.length === 0) return { kind: 'refused', reason: 'Nothing is cut' };
  if (!target) return { kind: 'refused', reason: 'Select one folder to paste into' };

  const container = cut.find((item) => item.itemType === 'directory' && (target.path === item.path || target.path.startsWith(`${item.path}/`)));
  if (container) {
    const where = target.path === container.path ? 'itself' : 'a folder inside it';
    return { kind: 'refused', reason: `Can’t move “${container.name}” into ${where}` };
  }

  const moving = cut.filter((item) => parentOf(item.path) !== target.path);
  if (moving.length === 0) return { kind: 'refused', reason: `Already in ${folderLabel(target.path)}` };
  if (target.isPrivate && moving.some((item) => !item.isPrivate)) {
    return { kind: 'refused', reason: `${folderLabel(target.path)} is private: add it to version control first` };
  }

  const taken = new Set(namesInTarget.map((name) => name.toLowerCase()));
  const moves: ItemMove[] = [];
  const clashes: string[] = [];
  for (const item of moving) {
    const name = item.name.toLowerCase();
    if (taken.has(name)) {
      clashes.push(item.name);
      continue;
    }
    // Two cut items of the same name, from different folders: the first one takes it.
    taken.add(name);
    moves.push({ from: item.path, to: target.path ? `${target.path}/${item.name}` : item.name, isPrivate: item.isPrivate });
  }
  if (moves.length === 0) {
    const reason = clashes.length === 1 ? `“${clashes[0]}” already exists in ${folderLabel(target.path)}` : `Their names are taken in ${folderLabel(target.path)}`;
    return { kind: 'refused', reason };
  }
  return { kind: 'ready', target: target.path, moves, clashes };
}

/** The moves that put the items back where they were. */
export function reverseMoves(moves: readonly ItemMove[]): ItemMove[] {
  return moves.map((move) => ({ from: move.to, to: move.from, isPrivate: move.isPrivate }));
}
