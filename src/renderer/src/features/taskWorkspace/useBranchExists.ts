import { useQuery } from '@tanstack/react-query';
import { SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { SELECTION_SETTLE_MS } from '../../lib/useSettled';
import { branchQuery } from '../branches/useBranches';

/**
 * Whether a branch typed as a new one already exists, asked once typing pauses (one `cm find` by name).
 * Undefined while that isn't known yet for the name as it stands.
 */
export function useBranchExists(workspacePath: string, branch: string | undefined): boolean | undefined {
  const settled = useDebouncedValue(branch, SELECTION_SETTLE_MS);
  const { data } = useQuery({ ...branchQuery(workspacePath, settled ?? ''), ...SLOW_CHANGING_QUERY, enabled: Boolean(settled) });
  if (!branch || settled !== branch || data === undefined) return undefined;
  return data !== null;
}
