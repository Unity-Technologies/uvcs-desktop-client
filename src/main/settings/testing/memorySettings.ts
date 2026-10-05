import type { AppSettings } from '@shared/domain/settings';
import type { SettingsStore } from '../SettingsStore';

/** A settings store kept in memory, starting from `initial`. */
export function memorySettings(initial: Partial<AppSettings> = {}): SettingsStore {
  let settings = { switchShelves: [], openWindows: [], ...initial } as unknown as AppSettings;
  return {
    get: () => settings,
    update: (changes: Partial<AppSettings>) => (settings = { ...settings, ...changes }),
  } as unknown as SettingsStore;
}
