import type { Lock } from '@shared/domain/lock';

/** A lock's row in the Locks view: an item holds one lock in its repository. */
export function lockKey(lock: Pick<Lock, 'repository' | 'itemId'>): string {
  return `${lock.repository}:${lock.itemId}`;
}
