import type { Lock } from '@shared/domain/lock';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { fileNameOf, pluralize } from '../../../lib/text';

/** A lock on a pending change: taken by me in this workspace (an exclusive checkout), or held by someone else. */
export interface PendingLock {
  mine: boolean;
  owner: string;
  workspace: string;
}

export type PendingLocks = ReadonlyMap<string, PendingLock>;

/**
 * Which pending changes are locked, by workspace path. Locks name server paths (`/art/Hero.fbx`), the same as the
 * workspace paths of a workspace mapped to the repository root. Only held locks count: a retained lock waits for a
 * merge and blocks nobody's checkin here.
 */
export function pendingLocks(changes: PendingChange[], mine: Lock[], all: Lock[]): PendingLocks {
  const pending = new Set(changes.map((change) => change.path));
  const mineIds = new Set(mine.map((lock) => lock.guid));
  const result = new Map<string, PendingLock>();
  for (const lock of [...mine, ...all]) {
    const path = lock.path.replace(/^\//, '');
    if (lock.status !== 'Locked' || !pending.has(path) || result.has(path)) continue;
    result.set(path, { mine: mineIds.has(lock.guid), owner: lock.owner, workspace: lock.workspace });
  }
  return result;
}

/** Explains why some changes can't be checked in, e.g. "Hero.fbx is locked by ana — …". */
export function lockedByOthersMessage(locked: { path: string; lock: PendingLock }[]): string {
  if (locked.length === 1) {
    const [{ path, lock }] = locked as [{ path: string; lock: PendingLock }];
    return `${fileNameOf(path)} is locked by ${lock.owner} — you can't check it in until the lock is released`;
  }
  return `${pluralize(locked.length, 'changed file')} are locked by others — you can't check them in until the locks are released`;
}
