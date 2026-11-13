import type { AppSettings } from '../domain/settings';

export interface SettingsApi {
  get(): Promise<AppSettings>;
  update(changes: Partial<AppSettings>): Promise<AppSettings>;
  /** Puts the workspace first in the recent list. The list is changed in one place, so windows don't overwrite each other's. */
  rememberRecentWorkspace(workspacePath: string): Promise<AppSettings>;
  forgetRecentWorkspace(workspacePath: string): Promise<AppSettings>;
  /**
   * Puts a check-in's comment first among the recent ones of its repository (a spec, `name@server`): changed in one
   * place, so windows checking in to other repositories meanwhile keep theirs (`withRecentComment`).
   */
  rememberRecentComment(repository: string, comment: string): Promise<AppSettings>;
}
