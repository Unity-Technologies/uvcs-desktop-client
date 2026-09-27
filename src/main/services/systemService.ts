import { homedir } from 'node:os';
import { normalize } from 'node:path';
import { app, dialog, net, shell } from 'electron';
import type { SystemApi } from '@shared/api/system';
import { checkSetup } from '../cm/setupCheck';
import { callerId } from '../ipc/caller';
import { GravatarCache } from '../system/gravatar';
import { openTerminal } from '../system/openTerminal';
import { untilSucceeded } from '../system/untilSucceeded';
import { showIncomingNotification } from '../window/incomingNotification';
import type { ServiceContext } from './ServiceContext';

export function createSystemService({ cm, operations, windows, settings }: ServiceContext): SystemApi {
  const gravatars = new GravatarCache(async (url) => {
    const response = await net.fetch(url);
    if (!response.ok) return null;
    return { type: response.headers.get('content-type') ?? 'image/png', bytes: new Uint8Array(await response.arrayBuffer()) };
  });

  // Every window asks when it opens: once `cm` runs and reaches its server, later windows take that answer.
  const cmVersion = untilSucceeded(async () => {
    cm.relocate();
    // Its own process: `cm shell` refuses to start until cm is configured, and that is reported by checkSetup.
    return (await cm.execute(['version'])).trim();
  });
  const setupProblem = untilSucceeded(() => checkSetup(cm), (problem) => problem === null);

  return {
    cmVersion,
    checkSetup: setupProblem,
    currentUser: async () => (await cm.query(['whoami'])).trim(),
    openPath: async (path) => {
      const error = await shell.openPath(normalize(path));
      if (error) throw new Error(error);
    },
    // In the OS's own separators: Explorer finds no item to select in `C:\wk/src/a.cs`.
    revealInFileManager: async (path) => shell.showItemInFolder(normalize(path)),
    openTerminal: (path) => openTerminal(normalize(path)),
    openExternal: (url) => shell.openExternal(url),
    moveToTrash: async (paths) => {
      for (const path of paths) await shell.trashItem(normalize(path));
    },
    pickDirectory: async (title, defaultPath) => {
      const result = await dialog.showOpenDialog({ title, defaultPath, properties: ['openDirectory', 'createDirectory'] });
      return result.canceled ? null : (result.filePaths[0] ?? null);
    },
    homeDirectory: async () => homedir(),
    cancelOperation: async (operationId) => operations.cancel(operationId),
    addRecentDocument: async (workspacePath) => app.addRecentDocument(workspacePath),
    takeRequestedWorkspace: async () => windows.takeRequested(callerId()),
    gravatar: async (user, size) => (settings.get().showGravatar ? gravatars.picture(user, size) : null),
    notifyIncoming: async (workspacePath, message) => showIncomingNotification(windows, workspacePath, message),
  };
}
