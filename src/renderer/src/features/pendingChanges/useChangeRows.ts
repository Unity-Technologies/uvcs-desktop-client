import { useMemo, useState } from 'react';
import type { Changelist, PendingChange } from '@shared/domain/pendingChanges';
import { changeKey, collapseRows, layoutChangeRows, topLevelCheckboxInset, type ChangeRow, type ChangesGrouping, type ChangesLayout } from './changeRows';

interface ChangeRowsInput {
  /** The changes shown, sorted and filtered. */
  changes: PendingChange[];
  changelists: Changelist[];
  layout: ChangesLayout;
  grouping: ChangesGrouping;
}

interface ChangeRows {
  /** The rows the list shows: those inside a closed folder or changelist left out. */
  rows: ChangeRow[];
  /** The changes shown by key: arrowing renders the view on every step, so what it asks of the selection is looked up. */
  changesByKey: ReadonlyMap<string, PendingChange>;
  /** The keys of the change rows in list order: the diff's navigation goes on to the files before and after. */
  fileKeys: string[];
  checkboxInset: number;
  toggleCollapsed: (key: string) => void;
}

/**
 * The rows of the Changes list and what the view looks up in them. Selecting a row or checking one renders the view
 * again: thousands of changes are laid out again only when they or their layout change.
 */
export function useChangeRows({ changes, changelists, layout, grouping }: ChangeRowsInput): ChangeRows {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const changesByKey = useMemo(() => new Map(changes.map((change) => [changeKey(change), change])), [changes]);
  const allRows = useMemo(() => layoutChangeRows({ changes, changelists, layout, grouping }), [changes, changelists, layout, grouping]);
  const rows = useMemo(() => collapseRows(allRows, collapsed), [allRows, collapsed]);
  const checkboxInset = useMemo(() => topLevelCheckboxInset(rows), [rows]);
  const fileKeys = useMemo(() => rows.flatMap((row) => (row.type === 'change' ? [row.key] : [])), [rows]);
  const toggleCollapsed = (key: string): void =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  return { rows, changesByKey, fileKeys, checkboxInset, toggleCollapsed };
}
