import { lstat } from 'node:fs/promises';

/** Whether anything is at `path`, a broken link included: what a new item there would replace. */
export async function pathExists(path: string): Promise<boolean> {
  return lstat(path).then(
    () => true,
    () => false,
  );
}
