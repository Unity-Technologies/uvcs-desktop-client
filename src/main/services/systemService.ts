import { homedir } from 'node:os';
import { app, dialog, shell } from 'electron';
import type { SystemApi } from '@shared/api/system';
import { checkSetup } from '../cm/setupCheck';
import { showIncomingNotification } from '../window/incomingNotification';
import { takeRequestedWorkspace } from '../window/recentDocuments';
import type { ServiceContext } from './ServiceContext';

export function createSystemService({ cm, operations }: ServiceContext): SystemApi {
  return {
    cmVersion: async () => {
      cm.relocate();
      // Its own process: `cm shell` refuses to start until cm is configured, and that is reported by checkSetup.
      return (await cm.execute(['version'])).trim();
    },
    checkSetup: () => checkSetup(cm),
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
    pickDirectory: async (title, defaultPath) => {
      const result = await dialog.showOpenDialog({ title, defaultPath, properties: ['openDirectory', 'createDirectory'] });
      return result.canceled ? null : (result.filePaths[0] ?? null);
    },
    homeDirectory: async () => homedir(),
    cancelOperation: async (operationId) => operations.cancel(operationId),
    addRecentDocument: async (workspacePath) => app.addRecentDocument(workspacePath),
    takeRequestedWorkspace: async () => takeRequestedWorkspace(),
    notifyIncoming: async (workspacePath, message) => showIncomingNotification(workspacePath, message),
  };
}
