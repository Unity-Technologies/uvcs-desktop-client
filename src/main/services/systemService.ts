import { dialog, shell } from 'electron';
import type { SystemApi } from '@shared/api/system';
import type { ServiceContext } from './ServiceContext';

export function createSystemService({ cm, operations }: ServiceContext): SystemApi {
  return {
    cmVersion: async () => (await cm.query(['version'])).trim(),
    currentUser: async () => (await cm.query(['whoami'])).trim(),
    openPath: async (path) => {
      const error = await shell.openPath(path);
      if (error) throw new Error(error);
    },
    revealInFileManager: async (path) => shell.showItemInFolder(path),
    openExternal: (url) => shell.openExternal(url),
    moveToTrash: async (paths) => {
      for (const path of paths) await shell.trashItem(path);
    },
    pickDirectory: async (title) => {
      const result = await dialog.showOpenDialog({ title, properties: ['openDirectory', 'createDirectory'] });
      return result.canceled ? null : (result.filePaths[0] ?? null);
    },
    cancelOperation: async (operationId) => operations.cancel(operationId),
  };
}
