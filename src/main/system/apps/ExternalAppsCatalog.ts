import type { ExternalApps } from '@shared/domain/externalApps';
import type { SettingsStore } from '../../settings/SettingsStore';
import type { AppFileSystem } from './appFileSystem';
import { externalAppList, type ExternalAppList } from './externalAppList';
import type { InstalledAppsCache } from './installedApps';
import type { LaunchCommand } from './launchCommand';
import type { Whereabouts } from './whereabouts';

export interface ExternalAppsDependencies {
  installedApps: InstalledAppsCache;
  settings: Pick<SettingsStore, 'get'>;
  where: () => Whereabouts;
  fs: AppFileSystem;
  launch: (command: LaunchCommand) => Promise<void>;
}

/**
 * The editors and terminals found here and the user's own, and opening a path in one: shared by the services that
 * open files (`appsService`, and `historyService` for a revision saved to a temp file).
 */
export class ExternalAppsCatalog {
  constructor(private readonly dependencies: ExternalAppsDependencies) {}

  async list(): Promise<ExternalApps> {
    return (await this.read()).apps;
  }

  /** Opens a file or folder in the editor `editorId`, or in the user's editor when it's omitted. */
  async openInEditor(path: string, editorId?: string): Promise<void> {
    const { apps, launchers } = await this.read();
    const id = editorId ?? apps.editorId;
    if (!id) throw new Error('No app to open it in was found. Add one in Settings.');
    await this.launch(launchers, id, path);
  }

  /** Opens the terminal `terminalId` in a folder, or the user's terminal when it's omitted. */
  async openInTerminal(folder: string, terminalId?: string): Promise<void> {
    const { apps, launchers } = await this.read();
    const id = terminalId ?? apps.terminalId;
    if (!id) throw new Error('No terminal app was found.');
    await this.launch(launchers, id, folder);
  }

  private async launch(launchers: ExternalAppList['launchers'], id: string, path: string): Promise<void> {
    const launcher = launchers.get(id);
    if (!launcher) throw new Error("That app isn't installed anymore.");
    await this.dependencies.launch(launcher(path));
  }

  private async read(): Promise<ExternalAppList> {
    const { installedApps, settings, where, fs } = this.dependencies;
    const { editor, terminal, customEditors } = settings.get();
    return externalAppList({ where: where(), installed: await installedApps.get(), fs, custom: customEditors, editorPreference: editor, terminalPreference: terminal });
  }
}
