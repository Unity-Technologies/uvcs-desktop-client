import type { Lock } from '@shared/domain/lock';

/** The locks as a message names them ("the lock on hero.psd", "3 locks"), never as the file, which stays. */
export function lockSubject(locks: readonly Pick<Lock, 'path'>[]): string {
  if (locks.length !== 1) return `${locks.length} locks`;
  const path = locks[0]!.path;
  return `the lock on ${path.slice(path.lastIndexOf('/') + 1)}`;
}
