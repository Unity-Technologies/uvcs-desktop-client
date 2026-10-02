import { normalize } from 'node:path';
import { dialog } from 'electron';
import type { AppsApi } from '@shared/api/apps';
import type { AppsContext } from './ServiceContext';

export function createAppsService({ apps }: AppsContext): AppsApi {
  return {
    list: () => apps.list(),
    // In the OS's own separators, as every app expects them.
    openInEditor: (path, editorId) => apps.openInEditor(normalize(path), editorId),
    openInTerminal: (folder, terminalId) => apps.openInTerminal(normalize(folder), terminalId),
    pickProgram: async () => {
      // A macOS app is kept as its bundle, opened the way Finder opens it (`open -a`).
      const result = await dialog.showOpenDialog({
        title: 'Choose an app',
        defaultPath: process.platform === 'darwin' ? '/Applications' : undefined,
        properties: ['openFile'],
      });
      return result.canceled ? null : (result.filePaths[0] ?? null);
    },
  };
}
