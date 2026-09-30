import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useSettings } from '../settings/useSettings';

/** Where new workspaces go: the folder from settings, or the home folder. */
export function useDefaultWorkspaceRoot(): string | undefined {
  const { defaultWorkspaceRoot } = useSettings();
  const { data: homeDirectory } = useQuery({ queryKey: queryKeys.homeDirectory, queryFn: () => api.system.homeDirectory(), staleTime: Infinity });
  return defaultWorkspaceRoot || homeDirectory;
}
