import type { ItemType } from '@shared/domain/pendingChanges';

/** A row of a list of changed files: a file's row holds its item; a group's header has none. */
export interface FileListRow {
  type: string;
  key: string;
  item?: { itemType: ItemType };
}

/**
 * The rows a diff steps on to past its last or first change (`FileStepsContext`), as the list shows them: every file,
 * binary, xlink and symlink included (their arrows go on too), never a folder or a group's header, which show no diff.
 */
export function fileRowKeys(rows: readonly FileListRow[]): string[] {
  return rows.flatMap((row) => (row.type === 'file' && row.item !== undefined && row.item.itemType !== 'directory' ? [row.key] : []));
}
