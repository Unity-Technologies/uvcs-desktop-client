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
import type { RepositoryGuid } from '@shared/domain/stableIds';
import { api } from '../../api/client';
import { saveShown, settingsQuery } from './useSettings';

// What the user keeps for one repository or one server (`RepositorySettings`, `ServerSettings`), read from the app's
// settings and changed one value at a time by the main process, so a window changing another repository's meanwhile
// keeps its own (ARCHITECTURE.md "Where a setting is kept"). A repository's are kept by its GUID
// (`useRepositoryGuid`; ARCHITECTURE.md "Settings survive renames"): a window reads and writes them only once it knows
// it, so a change made from what it shows never replaces what is kept with the empty copy shown meanwhile.

/** The repository's settings, by its GUID; empty while it isn't known. */
export function useRepositorySettings(repository: RepositoryGuid | undefined): RepositorySettings {
  const { data } = useQuery({ ...settingsQuery, select: (settings) => repositorySettingsOf(settings.repositorySettings, repository) });
  return data ?? repositorySettingsOf({}, undefined);
}

/** The server's settings; empty while none is known yet. */
export function useServerSettings(server: string | undefined): ServerSettings {
  const { data } = useQuery({ ...settingsQuery, select: (settings) => serverSettingsOf(settings.serverSettings, server) });
  return data ?? serverSettingsOf({}, undefined);
}

/**
 * Changes the repository's settings, under the GUID the window read them by: shown at once, confirmed by the main
 * process, put back and said when it can't save.
 */
export function updateRepositorySettings(repository: RepositoryGuid, changes: ScopedSettingsChange<RepositorySettings>): Promise<void> {
  return saveShown(
    (settings) => ({ ...settings, repositorySettings: withRepositorySettings(settings.repositorySettings, repository, changes) }),
    () => api.settings.updateRepositorySettings(repository, changes),
  );
}

/** Changes the server's settings, as `updateRepositorySettings` changes a repository's. */
export function updateServerSettings(server: string, changes: ScopedSettingsChange<ServerSettings>): Promise<void> {
  return saveShown(
    (settings) => ({ ...settings, serverSettings: withServerSettings(settings.serverSettings, server, changes) }),
    () => api.settings.updateServerSettings(server, changes),
  );
}
