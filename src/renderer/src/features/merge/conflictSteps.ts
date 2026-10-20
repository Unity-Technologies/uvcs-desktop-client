/** A row of a list of files, as the merge page and Incoming lay them out: a file's row holds its item. */
interface ListRow<T> {
  type: string;
  key: string;
  item?: T;
}

/**
 * The files a conflicting file's arrows go on to past its first or last conflict (`FileStepsContext`), as the list
 * shows them: the files still waiting for the user (`waits`), skipping those decided or merged automatically, and the
 * one shown, so the arrows know where they are once it's decided.
 */
export function conflictStepKeys<T>(rows: readonly ListRow<T>[], current: string | null, waits: (item: T) => boolean): string[] {
  return rows.flatMap((row) => (row.type === 'file' && row.item !== undefined && (row.key === current || waits(row.item)) ? [row.key] : []));
}
