import type { PendingChange } from '@shared/domain/pendingChanges';
import type { CheckState } from '../../ui/Checkbox';
import { CATEGORIES, CATEGORY_ORDER, categoryOf, type ChangeCategory } from './changeCategories';

export type ChangeRow =
  | { type: 'category'; key: string; category: ChangeCategory; label: string; count: number; checkState: CheckState; collapsed: boolean }
  | { type: 'directory'; key: string; category: ChangeCategory; path: string; name: string; depth: number; checkState: CheckState; collapsed: boolean }
  | { type: 'change'; key: string; change: PendingChange; depth: number; checked: boolean };

export type ChangesLayout = 'list' | 'tree';

interface BuildRowsInput {
  changes: PendingChange[];
  layout: ChangesLayout;
  isChecked: (change: PendingChange) => boolean;
  /** Keys of collapsed categories and directories. */
  collapsed: ReadonlySet<string>;
}

/** Flattens pending changes into the rows of the list: category headers, optional folders and changes. */
export function buildChangeRows({ changes, layout, isChecked, collapsed }: BuildRowsInput): ChangeRow[] {
  const rows: ChangeRow[] = [];

  for (const category of CATEGORY_ORDER) {
    const inCategory = changes.filter((change) => categoryOf(change) === category).sort((a, b) => a.path.localeCompare(b.path));
    if (inCategory.length === 0) continue;

    const key = `category:${category}`;
    rows.push({
      type: 'category',
      key,
      category,
      label: CATEGORIES[category].label,
      count: inCategory.length,
      checkState: combinedCheckState(inCategory, isChecked),
      collapsed: collapsed.has(key),
    });
    if (collapsed.has(key)) continue;

    if (layout === 'list') {
      inCategory.forEach((change) => rows.push({ type: 'change', key: changeKey(change), change, depth: 0, checked: isChecked(change) }));
    } else {
      appendTreeRows(rows, inCategory, category, isChecked, collapsed);
    }
  }
  return rows;
}

export function changeKey(change: PendingChange): string {
  return `change:${change.path}`;
}

function appendTreeRows(
  rows: ChangeRow[],
  changes: PendingChange[],
  category: ChangeCategory,
  isChecked: (change: PendingChange) => boolean,
  collapsed: ReadonlySet<string>,
): void {
  const emittedDirectories = new Set<string>();
  let hiddenBelow: string | null = null;

  for (const change of changes) {
    const segments = change.path.split('/');
    const directories = segments.slice(0, -1);

    if (hiddenBelow && change.path.startsWith(`${hiddenBelow}/`)) continue;
    hiddenBelow = null;

    let collapsedHere = false;
    directories.forEach((name, depth) => {
      if (collapsedHere) return;
      const path = directories.slice(0, depth + 1).join('/');
      const key = `directory:${category}:${path}`;
      if (!emittedDirectories.has(path)) {
        emittedDirectories.add(path);
        const inside = changes.filter((candidate) => candidate.path.startsWith(`${path}/`));
        rows.push({ type: 'directory', key, category, path, name, depth, checkState: combinedCheckState(inside, isChecked), collapsed: collapsed.has(key) });
      }
      if (collapsed.has(key)) {
        collapsedHere = true;
        hiddenBelow = path;
      }
    });

    if (!collapsedHere) rows.push({ type: 'change', key: changeKey(change), change, depth: directories.length, checked: isChecked(change) });
  }
}

export function combinedCheckState(changes: PendingChange[], isChecked: (change: PendingChange) => boolean): CheckState {
  const checkedCount = changes.filter(isChecked).length;
  if (checkedCount === 0) return false;
  return checkedCount === changes.length ? true : 'mixed';
}

/** The changes a category or directory row stands for. */
export function changesUnderRow(row: ChangeRow, changes: PendingChange[]): PendingChange[] {
  switch (row.type) {
    case 'category':
      return changes.filter((change) => categoryOf(change) === row.category);
    case 'directory':
      return changes.filter((change) => categoryOf(change) === row.category && change.path.startsWith(`${row.path}/`));
    case 'change':
      return [row.change];
  }
}
