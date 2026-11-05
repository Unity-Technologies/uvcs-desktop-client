import { isOnlyMine, pickedNames, type PeoplePick } from '../../../lib/peopleFilter';

/** Whose changesets the Timeline shows as a share of its curve, and how its hover card names them after their count. */
export interface ShareOwners {
  owners: ReadonlySet<string>;
  /** "yours", "by ana@example.com", "by the people picked". */
  word: string;
}

/** The people filter's picks when it picks some (the graph fades everyone else's too), else the user's own. */
export function shareOwners(pick: PeoplePick, me: string | undefined): ShareOwners {
  const picked = pickedNames(pick, me);
  if (picked === null || isOnlyMine(pick)) return { owners: picked ?? new Set(me === undefined ? [] : [me]), word: 'yours' };
  return { owners: picked, word: picked.size === 1 ? `by ${[...picked][0]}` : 'by the people picked' };
}
