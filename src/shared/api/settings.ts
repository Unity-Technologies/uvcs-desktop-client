import type { AppSettings } from '../domain/settings';

export interface SettingsApi {
  get(): Promise<AppSettings>;
  update(changes: Partial<AppSettings>): Promise<AppSettings>;
  /** Puts the workspace first in the recent list. The list is changed in one place, so windows don't overwrite each other's. */
  rememberRecentWorkspace(workspacePath: string): Promise<AppSettings>;
  forgetRecentWorkspace(workspacePath: string): Promise<AppSettings>;
}
