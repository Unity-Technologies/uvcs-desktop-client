import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AppSettings } from '@shared/domain/settings';
import { plasticConfigFolder } from '../plasticConfig/configFolder';
import { importLegacySettings } from '../settings/importLegacySettings';
import { SettingsStore } from '../settings/SettingsStore';

/** The app's own settings, in the user data folder; on the first run, with what the official client had set up. */
export function openSettings(userDataFolder: string): SettingsStore {
  const settings = new SettingsStore(join(userDataFolder, 'settings.json'));
  importLegacySettings(settings, plasticConfigFolder(process.platform, process.env, homedir()));
  return settings;
}

/** Every window gets the settings once they change in a way some window shows. */
export function sendSettingsChanges(settings: Pick<SettingsStore, 'onChanged'>, send: (settings: AppSettings) => void): void {
  settings.onChanged((changed, changes) => windowsShowAnyOf(changes) && send(changed));
}

/** The window bounds are saved as windows move and read only when one opens: no window shows them. */
export function windowsShowAnyOf(changes: Partial<AppSettings>): boolean {
  return Object.keys(changes).some((key) => key !== 'windowBounds');
}
