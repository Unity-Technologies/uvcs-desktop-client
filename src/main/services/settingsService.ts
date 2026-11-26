import type { SettingsApi } from '@shared/api/settings';
import type { ServiceContext } from './ServiceContext';

export function createSettingsService({ settings }: ServiceContext): SettingsApi {
  return {
    get: async () => settings.get(),
    update: async (changes) => settings.update(changes),
    rememberRecentWorkspace: async (workspacePath) => settings.rememberRecentWorkspace(workspacePath),
    forgetRecentWorkspace: async (workspacePath) => settings.forgetRecentWorkspace(workspacePath),
    rememberRecentComment: async (repository, comment) => settings.rememberRecentComment(repository, comment),
    setFavoriteOrganization: async (server, favorite) => settings.setFavoriteOrganization(server, favorite),
    updateRepositorySettings: async (repository, changes) => settings.updateRepositorySettings(repository, changes),
    updateServerSettings: async (server, changes) => settings.updateServerSettings(server, changes),
    addWindowSettings: async (kept) => settings.addWindowSettings(kept),
  };
}
