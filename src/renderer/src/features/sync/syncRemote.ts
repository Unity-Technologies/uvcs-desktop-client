import { useQuery } from '@tanstack/react-query';
import type { RepositorySummary } from '@shared/domain/repository';
import type { RepositorySettings, ScopedSettingsChange } from '@shared/domain/scopedSettings';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useRepositorySettings } from '../../app/settings/useScopedSettings';

// The repository a workspace's repository was last synced with (`RepositorySettings.syncRemote`): kept by its spec,
// which sync takes, and its GUID, which finds it again once renamed anywhere (ARCHITECTURE.md "Settings survive
// renames").

/** What picking `remote` keeps: its spec, and its GUID when its listing printed one. */
export function syncRemoteChange(remote: RepositorySummary): ScopedSettingsChange<RepositorySettings> {
  return { syncRemote: remote.spec, syncRemoteGuid: remote.guid ?? null };
}

/**
 * The spec of the repository `localRepository` syncs with, as it goes by now: the one kept, followed to its new name
 * once the server says it was renamed (`repositories.specNow`, read once per window). Null with none picked yet.
 */
export function useSyncRemote(localRepository: string | undefined): string | null {
  const { syncRemote, syncRemoteGuid } = useRepositorySettings(localRepository);
  const { data: followed } = useQuery({
    queryKey: queryKeys.repositorySpecNow(syncRemote ?? '', syncRemoteGuid ?? ''),
    queryFn: () => api.repositories.specNow(syncRemote!, syncRemoteGuid!),
    enabled: syncRemote !== undefined && syncRemoteGuid !== undefined,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  return followed ?? syncRemote ?? null;
}
