import { execFile } from 'node:child_process';

/** The Unity Version Control tray app. On Windows it runs the file system that serves dynamic workspaces' files. */
export const TRAY_IMAGE_NAME = 'unityvcstray.exe';

/** A listing slower than this counts as no tray: the dialog shouldn't wait on it. `tasklist` answers in about 150 ms. */
const LIST_TIMEOUT_MS = 3000;

/**
 * Whether `tasklist /FO CSV /NH` listed the tray: a line whose first field is its image name. With no match `tasklist`
 * prints a localized "no tasks" line instead, and still exits with 0, so the line itself is what tells.
 */
export function trayIsListed(output: string): boolean {
  return output
    .split(/\r?\n/)
    .some((line) => line.trim().toLowerCase().startsWith(`"${TRAY_IMAGE_NAME}",`));
}

export type RunTasklist = (args: string[]) => Promise<string>;

const runTasklist: RunTasklist = (args) =>
  new Promise((resolve, reject) => {
    execFile('tasklist', args, { timeout: LIST_TIMEOUT_MS, windowsHide: true }, (error, stdout) => (error ? reject(error) : resolve(stdout)));
  });

/**
 * Whether the tray runs, so dynamic workspaces can be created: on Windows only, where their file system lives in the
 * tray. It asks the OS, never the tray's config files, which belong to `cm` (ARCHITECTURE.md "`cm` owns its files").
 */
export async function readTrayRuns(platform: NodeJS.Platform, run: RunTasklist = runTasklist): Promise<boolean> {
  if (platform !== 'win32') return false;
  try {
    return trayIsListed(await run(['/FI', `IMAGENAME eq ${TRAY_IMAGE_NAME}`, '/FO', 'CSV', '/NH']));
  } catch {
    return false;
  }
}
