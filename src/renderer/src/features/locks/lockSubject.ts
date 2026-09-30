import type { Lock } from '@shared/domain/lock';
import { fileNameOf } from '../../lib/text';

/** The locks as a message names them ("the lock on hero.psd", "3 locks"), never as the file, which stays. */
export function lockSubject(locks: readonly Pick<Lock, 'path'>[]): string {
  if (locks.length !== 1) return `${locks.length} locks`;
  return `the lock on ${fileNameOf(locks[0]!.path)}`;
}
