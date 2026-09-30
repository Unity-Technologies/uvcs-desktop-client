import type { Lock } from '@shared/domain/lock';
import { isOnlyMine, type PeoplePick } from '../../lib/peopleFilter';
import { userFilterTexts } from '../../lib/userName';

/**
 * Whether Locks reads only the user's locks (`cm lock list --onlycurrentuser`): only for Mine alone. `cm` reads the
 * user's or everyone's, so other people, with or without the user, are picked among everyone's.
 */
export function readsOnlyMyLocks(people: PeoplePick): boolean {
  return isOnlyMine(people);
}

/** What the row shows, which its filter looks through: the item, its owner, the branches it's held on and released on, and the workspace. */
export function lockFilterTexts(lock: Lock): string[] {
  return [lock.path, ...userFilterTexts(lock.owner), lock.holderBranch, lock.destinationBranch, lock.workspace];
}
