import { normalize } from 'node:path';
import { dialog } from 'electron';
import type { AppsApi } from '@shared/api/apps';
import type { ExternalApps } from '@shared/domain/externalApps';
import type { AppsContext } from './ServiceContext';

export function createAppsService({ apps, icons }: Pick<AppsContext, 'apps' | 'icons'>, platform: NodeJS.Platform = process.platform): AppsApi {
  return {
    list: async (): Promise<ExternalApps> => {
      const list = await apps.list();
      const [editors, terminals] = await Promise.all([
        Promise.all(list.editors.map((app) => icons.withIcon(app, app.location))),
        Promise.all(list.terminals.map((app) => icons.withIcon(app, app.location))),
      ]);
      return { ...list, editors, terminals };
    },
    // In the OS's own separators, as every app expects them.
    openInEditor: (path, editorId) => apps.openInEditor(normalize(path), editorId),
    openInTerminal: (folder, terminalId) => apps.openInTerminal(normalize(folder), terminalId),
    pickProgram: async () => {
      // A macOS app is kept as its bundle, opened the way Finder opens it (`open -a`).
      const result = await dialog.showOpenDialog({
        title: 'Choose an app',
        defaultPath: platform === 'darwin' ? '/Applications' : undefined,
        properties: ['openFile'],
      });
      return result.canceled ? null : (result.filePaths[0] ?? null);
    },
  };
}
