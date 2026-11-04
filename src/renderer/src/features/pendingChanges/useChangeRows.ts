import { useMemo } from 'react';
import type { Changelist, PendingChange } from '@shared/domain/pendingChanges';
import { useCollapsedFolders } from '../../components/collapsedFoldersStore';
import { useFileTreeFolding, type FileTreeFolding } from '../../components/fileTreeFolding';
import type { FileListLayout } from '../../components/fileListViewStore';
import { fileRowKeys } from '../../components/fileRowKeys';
import type { ItemOrder } from '../../lib/pathTree';
import { rowLevelsOf, topLevelCheckboxInset, type RowLevels } from './changeRowLevels';
import { changeKey, collapseRows, layoutChangeRows, type ChangeRow, type ChangesGrouping } from './changeRows';

interface ChangeRowsInput {
  /** The changes shown, in `sortChanges` order and filtered: they are laid out as they come. */
  changes: PendingChange[];
  changelists: Changelist[];
  layout: FileListLayout;
  grouping: ChangesGrouping;
  groupByStatus: boolean;
  /** The order of the changes when not by path (`fileListOrder`). */
  order: ItemOrder<PendingChange> | undefined;
  /** Which list this is, for the folders and changelists closed in it (`useCollapsedFolders`). */
  scope: string;
}

interface ChangeRows {
  /** The rows the list shows: those inside a closed folder or changelist left out. */
  rows: ChangeRow[];
  /** The changes shown by key: arrowing renders the view on every step, so what it asks of the selection is looked up. */
  changesByKey: ReadonlyMap<string, PendingChange>;
  /**
   * The keys of the changes with a diff to show, in list order (`fileRowKeys`: never a folder): the diff's navigation goes
   * on to the files before and after, and the list selects the first.
   */
  fileKeys: string[];
  /** How the rows sit (`rowLevelsOf`), for their indents and guides. */
  levels: RowLevels;
  checkboxInset: number;
  /** Closing or opening every changelist, status group and folder; null for a flat list. */
  folding: FileTreeFolding | null;
  toggleCollapsed: (key: string) => void;
}

/**
 * The rows of the Changes list and what the view looks up in them. Selecting a row or checking one renders the view
 * again: thousands of changes are laid out again only when they or their layout change.
 */
export function useChangeRows({ changes, changelists, layout, grouping, groupByStatus, order, scope }: ChangeRowsInput): ChangeRows {
  const { collapsed, toggleCollapsed, closeOnly } = useCollapsedFolders(scope);
  const changesByKey = useMemo(() => new Map(changes.map((change) => [changeKey(change), change])), [changes]);
  const allRows = useMemo(() => layoutChangeRows({ sorted: changes, changelists, layout, grouping, groupByStatus, order }), [changes, changelists, layout, grouping, groupByStatus, order]);
  const rows = useMemo(() => collapseRows(allRows, collapsed), [allRows, collapsed]);
  const levels = useMemo(() => rowLevelsOf(rows, layout === 'tree'), [rows, layout]);
  const checkboxInset = topLevelCheckboxInset(levels);
  // The rows the diff steps on to: those with a diff to show, never a folder (`fileRowKeys`).
  const fileKeys = useMemo(() => fileRowKeys(rows), [rows]);
  const folding = useFileTreeFolding(allRows, rows, closeOnly);
  return { rows, changesByKey, fileKeys, levels, checkboxInset, folding, toggleCollapsed };
}
