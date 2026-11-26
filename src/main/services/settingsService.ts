import type { SettingsApi } from '@shared/api/settings';
import { repositorySpecParts } from '@shared/domain/repository';
import type { AppSettings, WindowKeptSettings } from '@shared/domain/settings';
import type { ServiceContext } from './ServiceContext';

export function createSettingsService({ settings, organizationRenames, repositoryGuids }: ServiceContext): SettingsApi {
  /** An organization that keeps something now records its id, so what it keeps follows it through a rename. */
  function followed(server: string, changed: AppSettings): AppSettings {
    void organizationRenames.follow([server]).catch((error: unknown) => console.warn('[settings] Organization not followed:', error));
    return changed;
  }

  /**
   * What a window's storage kept arrives by spec. A repository whose GUID a listing taught already may have had what
   * was kept by its spec moved before (`keepByGuid`): what arrives now goes under its GUID too, with no `cm` call.
   */
  function addWindowSettings(kept: WindowKeptSettings): AppSettings {
    settings.addWindowSettings(kept);
    for (const spec of Object.keys(kept.repositorySettings)) {
      const parts = repositorySpecParts(spec);
      const guid = parts && repositoryGuids.knownGuidOf(parts.server, parts.name);
      if (guid) settings.keepRepositoryByGuid(spec, guid);
    }
    return settings.get();
  }

  return {
    get: async () => settings.get(),
    update: async (changes) => settings.update(changes),
    rememberRecentWorkspace: async (workspacePath) => settings.rememberRecentWorkspace(workspacePath),
    forgetRecentWorkspace: async (workspacePath) => settings.forgetRecentWorkspace(workspacePath),
    rememberRecentComment: async (repository, comment) => settings.rememberRecentComment(repository, comment),
    setFavoriteOrganization: async (server, favorite) => followed(server, settings.setFavoriteOrganization(server, favorite)),
    updateRepositorySettings: async (repository, changes) => settings.updateRepositorySettings(repository, changes),
    updateServerSettings: async (server, changes) => followed(server, settings.updateServerSettings(server, changes)),
    addWindowSettings: async (kept) => addWindowSettings(kept),
  };
}
