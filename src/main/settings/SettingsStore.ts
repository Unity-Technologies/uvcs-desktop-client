import { mkdirSync, readFileSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/domain/settings';
import { replaceFileSync } from '../files/replaceFileSync';
import { withRecentBranch } from './recentBranches';
import { withoutRecentWorkspace, withRecentWorkspace } from './recentWorkspaces';

type ChangeListener = (settings: AppSettings, changes: Partial<AppSettings>) => void;

/**
 * App preferences persisted as JSON in the user data folder. Every window writes through this one store, one
 * change at a time; changes that depend on the stored value (the recent workspaces and branches) are computed here,
 * not by a window from a copy that another window may have changed meanwhile. The file is replaced whole or not at
 * all (`replaceFileSync`); one that can't be read as settings is kept aside (`settings.json.<when>.bak`) and the app
 * starts from the defaults.
 */
export class SettingsStore {
  private settings: AppSettings;
  private readonly listeners = new Set<ChangeListener>();

  constructor(
    private readonly filePath: string,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.settings = this.load();
  }

  get(): AppSettings {
    return this.settings;
  }

  update(changes: Partial<AppSettings>): AppSettings {
    const json = JSON.stringify({ ...this.settings, ...changes }, null, 2);
    mkdirSync(dirname(this.filePath), { recursive: true });
    replaceFileSync(this.filePath, json);
    // Read back rather than kept as given: values parsed from `cm` output (a switch shelve's repository) are slices
    // of the whole output, which V8 would keep in memory with them.
    this.settings = JSON.parse(json) as AppSettings;
    this.listeners.forEach((listener) => listener(this.settings, changes));
    return this.settings;
  }

  rememberRecentWorkspace(workspacePath: string): AppSettings {
    return this.update({ recentWorkspacePaths: withRecentWorkspace(this.settings.recentWorkspacePaths, workspacePath) });
  }

  forgetRecentWorkspace(workspacePath: string): AppSettings {
    return this.update({ recentWorkspacePaths: withoutRecentWorkspace(this.settings.recentWorkspacePaths, workspacePath) });
  }

  /** Puts a branch first among the workspace's recent branches. */
  rememberRecentBranch(workspaceGuid: string, branchGuid: string): AppSettings {
    const recent = this.settings.recentBranchesByWorkspace;
    return this.update({ recentBranchesByWorkspace: { ...recent, [workspaceGuid]: withRecentBranch(recent[workspaceGuid] ?? [], branchGuid) } });
  }

  onChanged(listener: ChangeListener): void {
    this.listeners.add(listener);
  }

  private load(): AppSettings {
    let json: string;
    try {
      json = readFileSync(this.filePath, 'utf8');
    } catch {
      // None yet (the first run), or unreadable: the defaults.
      return DEFAULT_SETTINGS;
    }
    try {
      const stored = JSON.parse(json) as Partial<AppSettings>;
      return {
        ...DEFAULT_SETTINGS,
        ...stored,
        pendingChanges: { ...DEFAULT_SETTINGS.pendingChanges, ...stored.pendingChanges },
      };
    } catch {
      this.keepAside();
      return DEFAULT_SETTINGS;
    }
  }

  /** Moves a file that isn't settings out of the way, named for when, so the next write doesn't lose it. */
  private keepAside(): void {
    const when = this.now().toISOString().replace(/[:.]/g, '-');
    try {
      renameSync(this.filePath, `${this.filePath}.${when}.bak`);
    } catch {
      // Left where it is: the next change replaces it.
    }
  }
}
