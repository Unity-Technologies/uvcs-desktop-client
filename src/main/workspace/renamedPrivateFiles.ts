import type { RenamedPrivateFile } from '@shared/domain/switchWithChanges';

const RENAMED = /^(.+)\.private\.\d+$/;

/**
 * Private files the switch found in the way of files it wrote: `cm` keeps each one next to it, renamed
 * `<name>.private.<n>`. Told apart from the workspace's own such files by the private paths before and after.
 */
export function renamedPrivateFiles(privateBefore: readonly string[], privateAfter: readonly string[]): RenamedPrivateFile[] {
  const before = new Set(privateBefore);
  return privateAfter.flatMap((renamedTo) => {
    const path = RENAMED.exec(renamedTo)?.[1];
    return path && before.has(path) && !before.has(renamedTo) ? [{ path, renamedTo }] : [];
  });
}
