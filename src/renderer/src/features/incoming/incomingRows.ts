import type { Changeset } from '@shared/domain/changeset';
import type { DiffEntry } from '@shared/domain/diff';

export type IncomingSelection = { kind: 'changeset'; id: number } | { kind: 'file'; path: string };

/** A row of the Incoming list: a section header, or something to select (`entryIndex`: its place among those). */
export type IncomingRow =
  | { type: 'section'; key: string; label: string; count: number }
  | { type: 'file'; key: string; file: DiffEntry; entryIndex: number }
  | { type: 'changeset'; key: string; changeset: Changeset; entryIndex: number };

export interface IncomingEntry {
  key: string;
  selection: IncomingSelection;
}

export function selectionKey(selection: IncomingSelection): string {
  return selection.kind === 'file' ? `file:${selection.path}` : `changeset:${selection.id}`;
}

/**
 * The list's rows: the files changed on both sides (locally and on the branch, or blocking the update) first, then the
 * changesets, then the other files. `entries` are the selectable rows in that order, for the arrows; `rowIndexOf`
 * finds a row by key without searching thousands of them.
 */
export function incomingRows(
  changesets: Changeset[],
  files: DiffEntry[],
  conflictPaths: ReadonlySet<string>,
  blockedPaths: ReadonlySet<string>,
): { rows: IncomingRow[]; entries: IncomingEntry[]; rowIndexOf: ReadonlyMap<string, number> } {
  const collides = (file: DiffEntry): boolean => conflictPaths.has(file.path) || blockedPaths.has(file.oldPath ?? file.path);
  const conflicting = files.filter(collides);
  const others = files.filter((file) => !collides(file));
  const rows: IncomingRow[] = [];
  const entries: IncomingEntry[] = [];
  const rowIndexOf = new Map<string, number>();

  const addEntry = (selection: IncomingSelection, row: (key: string, entryIndex: number) => IncomingRow): void => {
    const key = selectionKey(selection);
    rowIndexOf.set(key, rows.length);
    rows.push(row(key, entries.length));
    entries.push({ key, selection });
  };
  const addFiles = (label: string, sectionFiles: DiffEntry[]): void => {
    if (sectionFiles.length === 0) return;
    rows.push({ type: 'section', key: `section:${label}`, label, count: sectionFiles.length });
    for (const file of sectionFiles) addEntry({ kind: 'file', path: file.path }, (key, entryIndex) => ({ type: 'file', key, file, entryIndex }));
  };

  addFiles('Changed on both sides', conflicting);
  rows.push({ type: 'section', key: 'section:Changesets', label: 'Changesets', count: changesets.length });
  for (const changeset of changesets) {
    addEntry({ kind: 'changeset', id: changeset.id }, (key, entryIndex) => ({ type: 'changeset', key, changeset, entryIndex }));
  }
  addFiles('Files', others);
  return { rows, entries, rowIndexOf };
}
