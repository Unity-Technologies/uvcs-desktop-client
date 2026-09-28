import { useMemo } from 'react';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';

/** Everyone each list has shown in this session, by workspace and list. */
const seenByList = new Map<string, Set<string>>();

/**
 * The people a list read from the server can offer: everyone its rows have shown this session. A list filtered by
 * people on the server reads only theirs, so the others it showed before stay offered, with no query to list people.
 */
export function usePeopleSeen<Row>(list: string, rows: readonly Row[] | undefined, ownerOf: (row: Row) => string): readonly string[] {
  const workspacePath = useWorkspacePath();
  return useMemo(() => {
    const key = `${workspacePath}\n${list}`;
    const seen = seenByList.get(key) ?? new Set<string>();
    seenByList.set(key, seen);
    for (const row of rows ?? []) seen.add(ownerOf(row));
    return [...seen];
  }, [workspacePath, list, rows, ownerOf]);
}

