import { displayName } from './userName';

/**
 * Whose rows a list shows: the user's ("Mine"), people picked by name, both, or, with nobody picked, everyone's.
 * Every view with an owner filters by it the same way (`PeopleFilter`).
 */
export interface PeoplePick {
  mine: boolean;
  /** Other people, as `cm` names them, in the order they were picked. */
  others: readonly string[];
}

export const EVERYONE: PeoplePick = { mine: false, others: [] };
export const MINE: PeoplePick = { mine: true, others: [] };

/** People are picked by hand, and each one is a condition of the view's query: a handful, never a list of ids. */
export const MAX_PICKED_PEOPLE = 20;

export function isEveryone(pick: PeoplePick): boolean {
  return !pick.mine && pick.others.length === 0;
}

export function isOnlyMine(pick: PeoplePick): boolean {
  return pick.mine && pick.others.length === 0;
}

/**
 * The owners a `cm find` asks for (`me` for the user, whom `cm` knows as the one signed in), sorted so that the same
 * people share one query key; undefined for everyone.
 */
export function pickedOwners(pick: PeoplePick): string[] | undefined {
  if (isEveryone(pick)) return undefined;
  return [...(pick.mine ? ['me'] : []), ...[...pick.others].sort()];
}

/**
 * Whether a row by `owner` shows under the pick. `me` is the user's name, undefined while it's read: then the user's
 * rows can't be told apart, and a list read with `pickedOwners` has only the right ones anyway.
 */
export function matchesPeople(pick: PeoplePick, me: string | undefined, owner: string): boolean {
  if (isEveryone(pick) || pick.others.includes(owner)) return true;
  return pick.mine && (me === undefined || owner === me);
}

/** The names a pick keeps, for lists that only mark rows (the Branch Explorer fades the others'); null for everyone. */
export function pickedNames(pick: PeoplePick, me: string | undefined): ReadonlySet<string> | null {
  if (isEveryone(pick)) return null;
  return new Set([...pick.others, ...(pick.mine && me !== undefined ? [me] : [])]);
}

/** The pick with the user in or out. */
export function withMine(pick: PeoplePick, mine: boolean): PeoplePick {
  return { ...pick, mine };
}

/** The pick with `user` in or out; the user's own name is "Mine". No more than `MAX_PICKED_PEOPLE` are added. */
export function togglePerson(pick: PeoplePick, user: string, me: string | undefined): PeoplePick {
  if (user === me) return withMine(pick, !pick.mine);
  if (pick.others.includes(user)) return { ...pick, others: pick.others.filter((other) => other !== user) };
  if (pick.others.length >= MAX_PICKED_PEOPLE) return pick;
  return { ...pick, others: [...pick.others, user] };
}

/** Only `user`'s rows. */
export function onlyPerson(user: string, me: string | undefined): PeoplePick {
  return user === me ? MINE : { mine: false, others: [user] };
}

/** What the picker's button reads for the people picked by name: "Ana Diaz", "Ana Diaz +2"; empty for none. */
export function othersLabel(others: readonly string[]): string {
  const [first] = others;
  if (first === undefined) return '';
  return others.length === 1 ? displayName(first) : `${displayName(first)} +${others.length - 1}`;
}

/** The pick in words, for tooltips and screen readers: "Everyone", "Mine", "Mine and Ana Diaz", "Ana Diaz +2". */
export function describePick(pick: PeoplePick): string {
  if (isEveryone(pick)) return 'Everyone';
  if (pick.others.length === 0) return 'Mine';
  return pick.mine ? `Mine and ${othersLabel(pick.others)}` : othersLabel(pick.others);
}

/**
 * The people a picker offers besides the user (who has a row of their own): those picked first, as picked, then
 * everyone else in the list by the name shown.
 */
export function offeredPeople(people: Iterable<string>, pick: PeoplePick, me: string | undefined): string[] {
  const picked = new Set(pick.others);
  const rest = [...new Set(people)].filter((user) => user && user !== me && !picked.has(user));
  const byName = rest.map((user) => ({ user, name: displayName(user).toLowerCase() })).sort((a, b) => a.name.localeCompare(b.name) || a.user.localeCompare(b.user));
  return [...pick.others.filter((user) => user !== me), ...byName.map(({ user }) => user)];
}

/** The pick as remembered across sessions: whether it was "Mine". Other people are the repository's, kept for the session. */
export function rememberedPick(pick: PeoplePick): PeoplePick {
  return pick.mine ? MINE : EVERYONE;
}
