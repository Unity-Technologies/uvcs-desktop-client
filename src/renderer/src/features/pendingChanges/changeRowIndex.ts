import type { ChangeRow } from './changeRows';

/**
 * The list's rows by key, worked out once per layout: every arrow key renders the list, so rows are found by key,
 * never searched for.
 */
export interface ChangeRowIndex {
  /** The rows of files, in order. */
  changeRows: (ChangeRow & { type: 'change' })[];
  /** The keys of the files, in order. */
  orderedKeys: string[];
  /** The keys of every row, folders and changelists too: the keyboard moves through all of them. */
  rowKeys: string[];
  rowIndexes: Map<string, number>;
}

export function indexChangeRows(rows: ChangeRow[]): ChangeRowIndex {
  const changeRows: (ChangeRow & { type: 'change' })[] = [];
  const orderedKeys: string[] = [];
  const rowKeys: string[] = [];
  const rowIndexes = new Map<string, number>();
  rows.forEach((row, index) => {
    rowKeys.push(row.key);
    rowIndexes.set(row.key, index);
    if (row.type !== 'change') return;
    changeRows.push(row);
    orderedKeys.push(row.key);
  });
  return { changeRows, orderedKeys, rowKeys, rowIndexes };
}

/** `of`, remembered for each row it's asked about: a folder's check goes over everything in it once, not on every arrow key. */
export function perRow<T>(of: (row: ChangeRow) => T): (row: ChangeRow) => T {
  const known = new Map<ChangeRow, T>();
  return (row) => {
    if (!known.has(row)) known.set(row, of(row));
    return known.get(row)!;
  };
}
