import type { BranchExplorerData } from '@shared/domain/branchExplorer';
import { displayName } from '../../../lib/userName';
import { BRANCH_HUES } from './branchHue';
import type { RuleColors } from './ruleColors';

/** The hue a person's changesets take. */
export interface UserColor {
  /** As `cm` stores the owner: `jane@example.com`. */
  user: string;
  hue: number;
}

/**
 * The changeset colors by user, the same in every repository: people keep their color wherever they work. Off keeps
 * the list and colors nothing.
 */
export interface UserColors {
  on: boolean;
  users: readonly UserColor[];
}

export const DEFAULT_USER_COLORS: UserColors = { on: true, users: [] };

/** `users` added at the end, each with the first hue no one has yet (once every hue is taken, they repeat in order). */
export function withUsersAdded(colors: UserColors, users: readonly string[]): UserColors {
  const added = [...colors.users];
  for (const user of users) {
    if (!added.some((color) => color.user === user)) added.push({ user, hue: nextHue(added) });
  }
  return { ...colors, users: added };
}

function nextHue(taken: readonly UserColor[]): number {
  const used = new Set(taken.map((color) => color.hue));
  return BRANCH_HUES.find((hue) => !used.has(hue)) ?? BRANCH_HUES[taken.length % BRANCH_HUES.length]!;
}

export function withUserRemoved(colors: UserColors, user: string): UserColors {
  return { ...colors, users: colors.users.filter((color) => color.user !== user) };
}

export function withUserHue(colors: UserColors, user: string, hue: number): UserColors {
  return { ...colors, users: colors.users.map((color) => (color.user === user ? { user, hue } : color)) };
}

/** The people who can be added: those in `authors` without a color yet, by name. */
export function usersToAdd(authors: readonly string[], colors: UserColors): string[] {
  const colored = new Set(colors.users.map((color) => color.user));
  return authors.filter((author) => !colored.has(author)).sort((a, b) => displayName(a).localeCompare(displayName(b)));
}

/** The hue of each changeset in `data` whose owner has a color; none while the colors are off. */
export function changesetUserHues(data: BranchExplorerData, colors: UserColors): ReadonlyMap<number, number> {
  const hues = new Map<number, number>();
  if (!colors.on || colors.users.length === 0) return hues;
  const hueOf = new Map(colors.users.map((color) => [color.user, color.hue]));
  for (const changeset of data.changesets) {
    const hue = hueOf.get(changeset.owner);
    if (hue !== undefined) hues.set(changeset.id, hue);
  }
  return hues;
}

/** The format rules' colors with the users' under them: a changeset a format rule colors keeps the rule's hue. */
export function withUserColors(ruleColors: RuleColors, userHues: ReadonlyMap<number, number>): RuleColors {
  if (userHues.size === 0) return ruleColors;
  return { ...ruleColors, changesets: new Map([...userHues, ...ruleColors.changesets]) };
}
