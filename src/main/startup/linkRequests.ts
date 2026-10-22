import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname } from 'node:path';
import { app } from 'electron';
import { linkArgument } from '../links/linkArgument';
import { LinkRequests } from '../links/LinkRequests';
import { registerLinkScheme } from '../links/registerLinkScheme';
import { setDefaultLinkHandler } from '../links/xdgMime';
import type { WorkspaceWindows } from '../window/WorkspaceWindows';

/**
 * Takes the `uvcs://` links the OS hands the app (docs/features/deep-links.md, "Opening a link"): macOS's `open-url`
 * (listened to before Electron finishes launching, as a link may be what launched the app), and the link a launch or a
 * later one names on its command line (`linkArgument`). Each goes to the window in front once the first windows opened
 * (`LinkRequests.windowsOpened`). Called before the app is ready.
 */
export function receiveLinks(windows: WorkspaceWindows, launchArgv: readonly string[] = process.argv): LinkRequests {
  const links = new LinkRequests((link) => windows.openLink(link));
  app.on('will-finish-launching', () => {
    app.on('open-url', (event, url) => {
      event.preventDefault();
      links.received(url);
    });
  });
  app.on('second-instance', (_event, argv) => {
    const link = linkArgument(argv);
    if (link) links.received(link);
  });
  const launchLink = linkArgument(launchArgv);
  if (launchLink) links.received(launchLink);
  return links;
}

/**
 * Makes the installed app the handler of `uvcs://` again (`registerLinkScheme`). Development builds never register:
 * they would take the links from the installed app.
 */
export function registerAsLinkHandler(): void {
  if (!app.isPackaged) return;
  void registerLinkScheme({
    platform: process.platform,
    env: process.env,
    execPath: process.execPath,
    homeDirectory: homedir(),
    productName: app.getName(),
    readText: (path) => readFile(path, 'utf8').catch(() => null),
    writeText: async (path, text) => {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, text, 'utf8');
    },
    removeFile: (path) => rm(path, { force: true }),
    setDefaultLinkHandler,
    setAsDefaultProtocolClient: (protocol, path, args) => (path ? app.setAsDefaultProtocolClient(protocol, path, args) : app.setAsDefaultProtocolClient(protocol)),
  }).catch((error: unknown) => console.warn('[links] Could not register as the handler of uvcs:// links', error));
}
