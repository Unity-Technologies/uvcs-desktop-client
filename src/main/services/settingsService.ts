import type { SettingsApi } from '@shared/api/settings';
import type { AppSettings } from '@shared/domain/settings';
import type { ServiceContext } from './ServiceContext';

export function createSettingsService({ settings, organizationRenames }: ServiceContext): SettingsApi {
  /** An organization that keeps something now records its id, so what it keeps follows it through a rename. */
  function followed(server: string, changed: AppSettings): AppSettings {
    void organizationRenames.follow([server]).catch((error: unknown) => console.warn('[settings] Organization not followed:', error));
    return changed;
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
    addWindowSettings: async (kept) => settings.addWindowSettings(kept),
  };
}
