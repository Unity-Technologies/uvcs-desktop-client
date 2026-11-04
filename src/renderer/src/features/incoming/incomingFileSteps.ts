/** A row of Incoming's list of files: a file's row holds its item. */
interface IncomingListRow {
  type: string;
  key: string;
  item?: { itemType: string };
}

/**
 * The files a diff in Incoming goes on to past its last or first change (`FileStepsContext`), as the list shows them:
 * every file, image or binary included (their arrows go on too), never a folder or a group's header.
 */
export function incomingFileStepKeys(rows: readonly IncomingListRow[]): string[] {
  return rows.flatMap((row) => (row.type === 'file' && row.item !== undefined && row.item.itemType !== 'directory' ? [row.key] : []));
}
