import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/domain/settings';

/** App preferences persisted as JSON in the user data folder. */
export class SettingsStore {
  private settings: AppSettings;

  constructor(private readonly filePath: string) {
    this.settings = this.load();
  }

  get(): AppSettings {
    return this.settings;
  }

  update(changes: Partial<AppSettings>): AppSettings {
    this.settings = { ...this.settings, ...changes };
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2));
    return this.settings;
  }

  private load(): AppSettings {
    try {
      const stored = JSON.parse(readFileSync(this.filePath, 'utf8')) as Partial<AppSettings>;
      return {
        ...DEFAULT_SETTINGS,
        ...stored,
        pendingChanges: { ...DEFAULT_SETTINGS.pendingChanges, ...stored.pendingChanges },
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }
}
