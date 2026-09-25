import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useSettings } from '../../app/settings/useSettings';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { isCheckinCandidate } from './changeCategories';

export function pendingChangesKey(workspacePath: string) {
  return queryKeys.inWorkspace(workspacePath, 'pendingChanges');
}

export function usePendingChanges() {
  const workspacePath = useWorkspacePath();
  const { pendingChanges: filter } = useSettings();
  return useQuery({
    queryKey: [...pendingChangesKey(workspacePath), filter],
    queryFn: () => api.pendingChanges.list(workspacePath, filter),
    placeholderData: (previous) => previous,
  });
}

export function usePendingChangesCount(): number | undefined {
  const { data } = usePendingChanges();
  return data?.changes.filter(isCheckinCandidate).length;
}
