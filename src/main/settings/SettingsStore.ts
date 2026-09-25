import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/domain/settings';
import { withoutRecentWorkspace, withRecentWorkspace } from './recentWorkspaces';

type ChangeListener = (settings: AppSettings, changes: Partial<AppSettings>) => void;

/**
 * App preferences persisted as JSON in the user data folder. Every window writes through this one store, one
 * change at a time; changes that depend on the stored value (the recent workspaces) are computed here, not by
 * a window from a copy that another window may have changed meanwhile.
 */
export class SettingsStore {
  private settings: AppSettings;
  private readonly listeners = new Set<ChangeListener>();

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
    this.listeners.forEach((listener) => listener(this.settings, changes));
    return this.settings;
  }

  rememberRecentWorkspace(workspacePath: string): AppSettings {
    return this.update({ recentWorkspacePaths: withRecentWorkspace(this.settings.recentWorkspacePaths, workspacePath) });
  }

  forgetRecentWorkspace(workspacePath: string): AppSettings {
    return this.update({ recentWorkspacePaths: withoutRecentWorkspace(this.settings.recentWorkspacePaths, workspacePath) });
  }

  onChanged(listener: ChangeListener): void {
    this.listeners.add(listener);
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
