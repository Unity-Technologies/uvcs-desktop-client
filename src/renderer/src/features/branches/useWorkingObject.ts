import { useQuery } from '@tanstack/react-query';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { useChangeset } from '../changesets/useChangeset';
import { branchQuery } from './useBranches';
import { useWorkingObjectComment } from './useWorkingObjectComment';
import type { WorkingObject } from './workingObjectMenu';

/**
 * What the workspace is loaded from, for the top bar's menu. The branch is the one the top bar already reads for its
 * comment; a changeset or a label is read only once `wanted` (the pointer or focus is on the pill), one bounded query.
 */
export function useWorkingObject(workspace: WorkspaceInfo | undefined, wanted: boolean): WorkingObject | undefined {
  const selector = workspace?.selector;
  const kind = selector?.kind;
  const name = selector?.name ?? '';
  const path = workspace?.path ?? '';

  const branch = useQuery({ ...branchQuery(path, name), enabled: kind === 'branch', ...SLOW_CHANGING_QUERY });
  const changeset = useChangeset(kind === 'changeset' && wanted ? Number(name) : null);
  const labels = useQuery({
    queryKey: queryKeys.inWorkspace(path, 'labels', { text: name }),
    queryFn: () => api.labels.list(path, { text: name }),
    enabled: kind === 'label' && wanted,
    ...SLOW_CHANGING_QUERY,
  });
  const { data: comment } = useWorkingObjectComment(workspace);

  switch (kind) {
    case 'branch':
      return branch.data ? { kind, branch: branch.data } : undefined;
    case 'changeset':
      return changeset.data ? { kind, changeset: changeset.data } : undefined;
    case 'label': {
      const label = labels.data?.find((candidate) => candidate.name === name);
      return label ? { kind, label } : undefined;
    }
    case 'shelve':
      return workspace && { kind, shelve: { id: Number(name), comment: comment ?? '', repository: workspace.repository } };
    default:
      return undefined;
  }
}
