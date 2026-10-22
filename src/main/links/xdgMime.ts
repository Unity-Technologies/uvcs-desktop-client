import { execFile } from 'node:child_process';
import { LINK_SCHEME } from '@shared/links/formatLink';

/** `xdg-mime` writes one line of the user's `mimeapps.list` and answers at once; one that hangs is given up on. */
const XDG_MIME_TIMEOUT_MS = 5000;

/**
 * Makes a desktop entry the handler of `uvcs://` links on Linux: `xdg-mime default <id> x-scheme-handler/uvcs`. Not
 * Electron's `setAsDefaultProtocolClient`, which there registers only the app's own desktop id (`CHROME_DESKTOP`),
 * and the handler has an id of its own (`linkHandlerDesktopId`). Never in the main process's way: it runs on its own,
 * and a desktop without `xdg-mime` only leaves the scheme unregistered.
 */
export function setDefaultLinkHandler(desktopId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('xdg-mime', ['default', desktopId, `x-scheme-handler/${LINK_SCHEME}`], { timeout: XDG_MIME_TIMEOUT_MS }, (error) => (error ? reject(error) : resolve()));
  });
}
