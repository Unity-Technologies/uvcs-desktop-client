import type { RepositorySettings, ScopedSettingsChange, ServerSettings } from '../domain/scopedSettings';
import type { AppSettings, WindowKeptSettings } from '../domain/settings';
import type { RepositoryGuid } from '../domain/stableIds';

export interface SettingsApi {
  get(): Promise<AppSettings>;
  update(changes: Partial<AppSettings>): Promise<AppSettings>;
  /** Puts the workspace first in the recent list. The list is changed in one place, so windows don't overwrite each other's. */
  rememberRecentWorkspace(workspacePath: string): Promise<AppSettings>;
  forgetRecentWorkspace(workspacePath: string): Promise<AppSettings>;
  /**
   * Puts a check-in's comment first among the recent ones of its repository (its GUID, `repositories.guidOf`): changed
   * in one place, so windows checking in to other repositories meanwhile keep theirs (`withRecentComment`).
   */
  rememberRecentComment(repository: RepositoryGuid, comment: string): Promise<AppSettings>;
  /** Adds an organization (its server, `acme@unity`) to the favorites, or removes it: changed in one place, as above. */
  setFavoriteOrganization(server: string, favorite: boolean): Promise<AppSettings>;
  /** Changes one repository's settings (by its GUID), keeping every other repository's: changed in one place, as above. */
  updateRepositorySettings(repository: RepositoryGuid, changes: ScopedSettingsChange<RepositorySettings>): Promise<AppSettings>;
  /** Changes one server's settings, keeping every other server's: changed in one place, as above. */
  updateServerSettings(server: string, changes: ScopedSettingsChange<ServerSettings>): Promise<AppSettings>;
  /** Takes what the window's storage kept before the settings held it, where the settings keep nothing yet. */
  addWindowSettings(kept: WindowKeptSettings): Promise<AppSettings>;
}
