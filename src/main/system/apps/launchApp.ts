import { spawn } from 'node:child_process';
import type { LaunchCommand } from './launchCommand';

/**
 * The one place an editor or a terminal is started, and only on the user's explicit "Open in…" (see
 * `noExternalUi.test.ts`). Resolves once the app has started; rejects when it can't be.
 */
export function launchApp({ command, args, cwd, exits, verbatim }: LaunchCommand): Promise<void> {
  return new Promise((resolve, reject) => {
    const failed = (reason: string) => reject(new Error(`Couldn't start ${command}: ${reason}`));
    // A launcher is hidden: its own console (cmd's, running `start`) would flash on Windows. An app must show, and
    // keeps running when this app quits.
    const child = spawn(command, args, { cwd, detached: !exits, stdio: 'ignore', windowsHide: exits, windowsVerbatimArguments: verbatim });
    child.once('error', (error: NodeJS.ErrnoException) => failed(error.code === 'ENOENT' ? 'it is not there anymore' : error.message));
    if (exits) {
      child.once('exit', (code) => (code === 0 ? resolve() : failed(`it ended with code ${code}`)));
      return;
    }
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}
