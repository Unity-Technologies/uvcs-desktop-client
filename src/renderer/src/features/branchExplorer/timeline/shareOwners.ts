import { isOnlyMine, pickedNames, type PeoplePick } from '../../../lib/peopleFilter';

/** Whose changesets the Timeline shows as a share of its curve, and whether they are the user's own. */
export interface ShareOwners {
  owners: ReadonlySet<string>;
  isMine: boolean;
}

/** The people filter's picks when it picks some (the graph fades everyone else's too), else the user's own. */
export function shareOwners(pick: PeoplePick, me: string | undefined): ShareOwners {
  const picked = pickedNames(pick, me);
  if (picked === null) return { owners: new Set(me === undefined ? [] : [me]), isMine: true };
  return { owners: picked, isMine: isOnlyMine(pick) };
}
