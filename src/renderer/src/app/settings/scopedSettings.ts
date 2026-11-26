import { useQuery } from '@tanstack/react-query';
import {
  repositorySettingsOf,
  serverSettingsOf,
  withRepositorySettings,
  withServerSettings,
  type RepositorySettings,
  type ScopedSettingsChange,
  type ServerSettings,
} from '@shared/domain/scopedSettings';
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/domain/settings';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { toast } from '../../ui/toast/toastStore';
import { queryClient } from '../queryClient';
import { settingsQuery } from './useSettings';

// What the user keeps for one repository or one server (`RepositorySettings`, `ServerSettings`), read from the app's
// settings and changed one value at a time by the main process, so a window changing another repository's meanwhile
// keeps its own (ARCHITECTURE.md "Where a setting is kept").

/** The repository's settings (a spec, however written); empty while none is known yet. */
export function useRepositorySettings(repository: string | undefined): RepositorySettings {
  const { data } = useQuery({ ...settingsQuery, select: (settings) => repositorySettingsOf(settings.repositorySettings, repository) });
  return data ?? repositorySettingsOf({}, undefined);
}

/** The server's settings; empty while none is known yet. */
export function useServerSettings(server: string | undefined): ServerSettings {
  const { data } = useQuery({ ...settingsQuery, select: (settings) => serverSettingsOf(settings.serverSettings, server) });
  return data ?? serverSettingsOf({}, undefined);
}

/** Changes the repository's settings: shown at once, confirmed by the main process, put back and said when it can't save. */
export function updateRepositorySettings(repository: string, changes: ScopedSettingsChange<RepositorySettings>): Promise<void> {
  return saveScoped(
    (settings) => ({ ...settings, repositorySettings: withRepositorySettings(settings.repositorySettings, repository, changes) }),
    () => api.settings.updateRepositorySettings(repository, changes),
  );
}

/** Changes the server's settings, as `updateRepositorySettings` changes a repository's. */
export function updateServerSettings(server: string, changes: ScopedSettingsChange<ServerSettings>): Promise<void> {
  return saveScoped(
    (settings) => ({ ...settings, serverSettings: withServerSettings(settings.serverSettings, server, changes) }),
    () => api.settings.updateServerSettings(server, changes),
  );
}

async function saveScoped(shown: (settings: AppSettings) => AppSettings, save: () => Promise<AppSettings>): Promise<void> {
  const current = queryClient.getQueryData<AppSettings>(queryKeys.settings) ?? DEFAULT_SETTINGS;
  queryClient.setQueryData(queryKeys.settings, shown(current));
  try {
    queryClient.setQueryData(queryKeys.settings, await save());
  } catch (error) {
    queryClient.setQueryData(queryKeys.settings, current);
    toast.error("Couldn't save the settings", error);
  }
}
