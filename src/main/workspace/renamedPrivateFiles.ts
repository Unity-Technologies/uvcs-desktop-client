import type { PendingChangesSnapshot } from '@shared/domain/pendingChanges';
import type { RenamedPrivateFile } from '@shared/domain/switchWithChanges';
import type { CmClient } from '../cm/CmClient';
import { readPrivatePaths } from './readPendingChanges';

const RENAMED = /^(.+)\.private\.\d+$/;

/**
 * The private files a switch renamed, from the snapshot read before it. Private files can only be in the way when
 * there were some: otherwise nothing more is read.
 */
export async function privatesRenamedBySwitch(cm: CmClient, workspacePath: string, before: PendingChangesSnapshot): Promise<RenamedPrivateFile[] | undefined> {
  const privateBefore = before.changes.filter((change) => change.kinds.includes('private')).map((change) => change.path);
  if (privateBefore.length === 0) return undefined;
  try {
    const renamed = renamedPrivateFiles(privateBefore, await readPrivatePaths(cm, workspacePath));
    return renamed.length > 0 ? renamed : undefined;
  } catch {
    // The switch is done; this only adds to what it tells.
    return undefined;
  }
}

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
