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
import { api } from '../../api/client';
import { toast } from '../../ui/toast/toastStore';
import { useRepositoryGuid } from '../workspace/repositoryGuid';
import { repositoryGuidToWrite } from '../workspace/repositoryGuidToWrite';
import { saveShown, settingsQuery } from './useSettings';

// What the user keeps for one repository or one server (`RepositorySettings`, `ServerSettings`), read from the app's
// settings and changed one value at a time by the main process, so a window changing another repository's meanwhile
// keeps its own (ARCHITECTURE.md "Where a setting is kept"). A repository's are kept by its GUID, which the
// repository's spec is read for (`useRepositoryGuid`; ARCHITECTURE.md "Settings survive renames").

/** The repository's settings (a spec); empty while its GUID is read, and when it can't be. */
export function useRepositorySettings(repository: string | undefined): RepositorySettings {
  const guid = useRepositoryGuid(repository);
  const { data } = useQuery({ ...settingsQuery, select: (settings) => repositorySettingsOf(settings.repositorySettings, guid) });
  return data ?? repositorySettingsOf({}, undefined);
}

/** The server's settings; empty while none is known yet. */
export function useServerSettings(server: string | undefined): ServerSettings {
  const { data } = useQuery({ ...settingsQuery, select: (settings) => serverSettingsOf(settings.serverSettings, server) });
  return data ?? serverSettingsOf({}, undefined);
}

/**
 * Changes the repository's settings (a spec): shown at once, confirmed by the main process, put back and said when it
 * can't save. Said too when the repository's GUID, which they are kept by, can't be read.
 */
export async function updateRepositorySettings(repository: string, changes: ScopedSettingsChange<RepositorySettings>): Promise<void> {
  let guid;
  try {
    guid = await repositoryGuidToWrite(repository);
  } catch (error) {
    toast.error("Couldn't save the settings", error);
    return;
  }
  return saveShown(
    (settings) => ({ ...settings, repositorySettings: withRepositorySettings(settings.repositorySettings, guid, changes) }),
    () => api.settings.updateRepositorySettings(guid, changes),
  );
}

/** Changes the server's settings, as `updateRepositorySettings` changes a repository's. */
export function updateServerSettings(server: string, changes: ScopedSettingsChange<ServerSettings>): Promise<void> {
  return saveShown(
    (settings) => ({ ...settings, serverSettings: withServerSettings(settings.serverSettings, server, changes) }),
    () => api.settings.updateServerSettings(server, changes),
  );
}
