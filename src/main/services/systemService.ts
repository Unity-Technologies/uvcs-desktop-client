import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { normalize } from 'node:path';
import { app, dialog, net, shell } from 'electron';
import type { SystemApi } from '@shared/api/system';
import { showsGravatar } from '@shared/domain/gravatarChoice';
import { checkSetup } from '../cm/setupCheck';
import { cmFoundText } from '../diagnostics/logRecords';
import { outermostPaths } from '../files/pathContainment';
import { callerId } from '../ipc/caller';
import { readDraggedPath } from '../system/dragPasteboard';
import { describeDraggedFolder } from '../system/draggedFolder';
import { GravatarCache } from '../system/gravatar';
import { untilSucceeded } from '../system/untilSucceeded';
import { isWebAddress } from '../system/webAddress';
import { showIncomingNotification } from '../window/incomingNotification';
import type { ProfilesContext, ServiceContext } from './ServiceContext';

export function createSystemService({ cm, operations, windows, settings, diagnosticLog }: ServiceContext, { profiles }: ProfilesContext): SystemApi {
  const gravatars = new GravatarCache(async (url) => {
    const response = await net.fetch(url);
    if (!response.ok) return null;
    return { type: response.headers.get('content-type') ?? 'image/png', bytes: new Uint8Array(await response.arrayBuffer()) };
  });

  // Every window asks when it opens: once a `cm` runs and reaches its server, later windows take that answer. Kept per
  // executable: choosing another `cm` in Settings (`cmRuntime.use`) asks the new one, and logs where it is.
  const versions = new Map<string, () => Promise<string>>();
  const cmVersion = (): Promise<string> => {
    cm.relocate();
    const executable = cm.executable;
    let version = versions.get(executable);
    if (!version) {
      version = untilSucceeded(async () => {
        // Its own process: `cm shell` refuses to start until cm is configured, and that is reported by checkSetup.
        const answer = (await cm.execute(['version'])).trim();
        // Once per `cm` a launch runs: the log's reader learns which one the app ran, with no command of its own.
        diagnosticLog.write(cmFoundText(answer, executable));
        return answer;
      });
      versions.set(executable, version);
    }
    return version();
  };
  const setupProblem = untilSucceeded(() => checkSetup(profiles, cm.executable), (problem) => problem === null);

  return {
    cmVersion,
    checkSetup: setupProblem,
    currentUser: async () => (await cm.query(['whoami'], { anyDirectory: true })).trim(),
    openPath: async (path) => {
      const error = await shell.openPath(normalize(path));
      if (error) throw new Error(error);
    },
    // In the OS's own separators: Explorer finds no item to select in `C:\wk/src/a.cs`.
    revealInFileManager: async (path) => shell.showItemInFolder(normalize(path)),
    openExternal: async (url) => {
      if (!isWebAddress(url)) throw new Error(`Only web pages open in the browser: ${url}`);
      await shell.openExternal(url);
    },
    moveToTrash: async (paths) => {
      // A folder takes what's picked inside it along, and what's already gone has nothing left to trash.
      for (const path of outermostPaths(paths.map((path) => normalize(path)), process.platform)) {
        if (existsSync(path)) await shell.trashItem(path);
      }
    },
    draggedFolder: async () => describeDraggedFolder(await readDraggedPath(process.platform)),
    pickDirectory: async (title, defaultPath) => {
      const result = await dialog.showOpenDialog({ title, defaultPath, properties: ['openDirectory', 'createDirectory'] });
      return result.canceled ? null : (result.filePaths[0] ?? null);
    },
    homeDirectory: async () => homedir(),
    cancelOperation: async (operationId) => operations.cancel(operationId),
    addRecentDocument: async (workspacePath) => app.addRecentDocument(workspacePath),
    takeRequestedPlace: async () => windows.takeRequested(callerId()),
    // The one gate on Gravatar: nothing goes there until the user turned pictures on themselves.
    gravatar: async (user, size) => (showsGravatar(settings.get()) ? gravatars.picture(user, size) : null),
    logUnexpectedError: async (error) => diagnosticLog.write(`Unexpected error in a window: ${error.details}`),
    notifyIncoming: async (workspacePath, message) => showIncomingNotification(windows, workspacePath, message),
  };
}
