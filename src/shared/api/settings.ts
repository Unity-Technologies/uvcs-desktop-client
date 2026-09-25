import type { AppSettings } from '../domain/settings';

export interface SettingsApi {
  get(): Promise<AppSettings>;
  update(changes: Partial<AppSettings>): Promise<AppSettings>;
}
