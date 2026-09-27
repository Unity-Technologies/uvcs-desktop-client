import { lstat, rename } from 'node:fs/promises';
import { basename } from 'node:path';

/**
 * Renames a private item on disk (`cm mv` only moves controlled ones). Fails rather than replace another item, a
 * broken symbolic link included; a rename that only changes case finds the item itself there on case-insensitive disks.
 */
export async function renamePrivate(fromPath: string, toPath: string): Promise<void> {
  const changesOnlyCase = fromPath.toLowerCase() === toPath.toLowerCase();
  const taken = await lstat(toPath).then(
    () => true,
    () => false,
  );
  if (taken && !changesOnlyCase) throw new Error(`${basename(toPath)} already exists.`);
  await rename(fromPath, toPath);
}
