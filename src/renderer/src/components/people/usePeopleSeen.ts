import { useMemo } from 'react';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { createPeopleSeen } from './peopleSeen';

const peopleSeen = createPeopleSeen();

/**
 * The people a list read from the server can offer: everyone its rows have shown this session. A list filtered by
 * people on the server reads only theirs, so the others it showed before stay offered, with no query to list people.
 */
export function usePeopleSeen<Row>(list: string, rows: readonly Row[] | undefined, ownerOf: (row: Row) => string): readonly string[] {
  const workspacePath = useWorkspacePath();
  return useMemo(() => peopleSeen.remember(workspacePath, list, (rows ?? []).map(ownerOf)), [workspacePath, list, rows, ownerOf]);
}
