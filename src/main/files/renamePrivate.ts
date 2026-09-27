import type { BigIntStats } from 'node:fs';
import { lstat, rename } from 'node:fs/promises';
import { basename } from 'node:path';
import { retryWhileBusy } from './whileBusy';

/**
 * Renames a private item on disk (`cm mv` only moves controlled ones). Fails rather than replace another item, a
 * broken symbolic link included; a rename that only changes case finds the item itself there on case-insensitive disks
 * (Windows, macOS), told by its file id: on Linux `Notes.txt` and `notes.txt` are two files.
 */
export async function renamePrivate(fromPath: string, toPath: string): Promise<void> {
  const [from, taken] = await Promise.all([lstat(fromPath, { bigint: true }), lstat(toPath, { bigint: true }).catch(() => null)]);
  if (taken && !isSameItem(from, taken, fromPath, toPath)) throw new Error(`${basename(toPath)} already exists.`);
  await retryWhileBusy(() => rename(fromPath, toPath));
}

function isSameItem(from: BigIntStats, taken: BigIntStats, fromPath: string, toPath: string): boolean {
  // Some network shares report no file ids: then only a change of case can be the item itself.
  if (from.ino === 0n) return fromPath.toLowerCase() === toPath.toLowerCase();
  return taken.ino === from.ino && taken.dev === from.dev;
}
