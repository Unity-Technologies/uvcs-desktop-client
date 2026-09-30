import { useQuery } from '@tanstack/react-query';
import type { PendingChangesSnapshot } from '@shared/domain/pendingChanges';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useSettings } from '../../app/settings/useSettings';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { isCheckinCandidate } from './changeCategories';
import { sharePendingChanges } from './sharePendingChanges';

function pendingChangesKey(workspacePath: string) {
  return queryKeys.inWorkspace(workspacePath, 'pendingChanges');
}

export function usePendingChanges() {
  return usePendingChangesOf(useWorkspacePath());
}

/** Like `usePendingChanges`, for code that also runs without a workspace (null). */
export function usePendingChangesOf(workspacePath: string | null) {
  const { pendingChanges: filter } = useSettings();
  return useQuery({
    queryKey: [...pendingChangesKey(workspacePath ?? ''), filter],
    queryFn: () => api.pendingChanges.list(workspacePath!, filter),
    structuralSharing: (previous, next) => sharePendingChanges(previous as PendingChangesSnapshot | undefined, next as PendingChangesSnapshot),
    placeholderData: (previous) => previous,
    enabled: workspacePath !== null,
  });
}

export function usePendingChangesCount(): number | undefined {
  const { data } = usePendingChanges();
  return data?.changes.filter(isCheckinCandidate).length;
}
