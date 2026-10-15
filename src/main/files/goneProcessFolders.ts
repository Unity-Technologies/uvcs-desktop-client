// The app's folders under the OS's temp folder are named with the process that owns them (`<prefix><pid>-…`), so a
// session can delete what one killed or crashed left, never what another app running beside it (a development build
// beside the installed one, each with its profile) uses: the owner, never "any other", tells.

import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

export interface OwnedFolders {
  tempFolder: string;
  /** What the folders' names start with, before their owner's pid: `uvcs-`, `uvcs-revisions-`. */
  prefix: string;
  /** This process's id, and whether another is running. */
  pid: number;
  isRunning: (pid: number) => boolean;
}

/** Whether a folder of this name was left by a process that is gone: named `<prefix><pid>-…`, its pid not running. */
export function isFolderOfGoneProcess(name: string, { prefix, pid, isRunning }: Omit<OwnedFolders, 'tempFolder'>): boolean {
  if (!name.startsWith(prefix)) return false;
  const owner = /^(\d+)-/.exec(name.slice(prefix.length));
  if (!owner) return false;
  const ownerPid = Number(owner[1]);
  return ownerPid !== pid && !isRunning(ownerPid);
}

/** Deletes the folders processes that are gone left (`isFolderOfGoneProcess`); one that can't be deleted stays. */
export async function removeFoldersOfGoneProcesses(owned: OwnedFolders): Promise<void> {
  const names = await readdir(owned.tempFolder).catch(() => []);
  const leftOver = names.filter((name) => isFolderOfGoneProcess(name, owned));
  await Promise.all(leftOver.map((name) => rm(join(owned.tempFolder, name), { recursive: true, force: true }).catch(() => undefined)));
}
