import type { BranchExplorerData } from '@shared/domain/branchExplorer';
import { matchesWordFilter } from '../../../lib/matchesAllWords';
import { displayName, userFilterTexts } from '../../../lib/userName';
import { BRANCH_HUES } from './branchHue';
import { isOnIn, type OffByRepository } from './offByRepository';
import type { RuleColors } from './ruleColors';

/** The hue a person's changesets take. */
export interface UserColor {
  /** As `cm` stores the owner: `jane@example.com`. */
  user: string;
  hue: number;
}

/**
 * The changeset colors by user, the same in every repository: people keep their color wherever they work. Whether they
 * apply is each repository's own (`appliedUserColorsOf`).
 */
export interface UserColors {
  users: readonly UserColor[];
}

export const DEFAULT_USER_COLORS: UserColors = { users: [] };

/** `users` added at the end, each with the first hue no one has yet (once every hue is taken, they repeat in order). */
export function withUsersAdded(colors: UserColors, users: readonly string[]): UserColors {
  const added = [...colors.users];
  for (const user of users) {
    if (!added.some((color) => color.user === user)) added.push({ user, hue: nextHue(added) });
  }
  return { users: added };
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

export function isColored(colors: UserColors, user: string): boolean {
  return colors.users.some((color) => color.user === user);
}

/** Picking a person in "Add people": gives them a color, or takes back the one just given. */
export function withUserToggled(colors: UserColors, user: string): UserColors {
  return isColored(colors, user) ? withUserRemoved(colors, user) : withUsersAdded(colors, [user]);
}

/**
 * Whether adding people turns the colors on: the first ones do, since the empty tab shows no switch to say they're off.
 */
export function addingTurnsColorsOn(colors: UserColors, on: boolean): boolean {
  return !on && colors.users.length === 0;
}

/**
 * The colors the graph applies in `repository`: none while they're turned off there, keeping them. The same object
 * while off, so a store selector answering it doesn't render forever.
 */
export function appliedUserColorsOf(colors: UserColors, off: OffByRepository, repository: string | undefined): UserColors {
  return isOnIn(off, repository) ? colors : DEFAULT_USER_COLORS;
}

/** What the "Changeset colors" tab shows: an invitation while no one has a color, else the list, dimmed while off. */
export type ChangesetColorsTabBody = { state: 'empty' } | { state: 'list'; dimmed: boolean };

export function changesetColorsTabBody(colors: UserColors, on: boolean): ChangesetColorsTabBody {
  return colors.users.length === 0 ? { state: 'empty' } : { state: 'list', dimmed: !on };
}

/** The people "Add people" lists: those it offers (`usersToAdd`) whose name or user matches every word searched. */
export function peopleMatching(offered: readonly string[], search: string): readonly string[] {
  return offered.filter((user) => matchesWordFilter(userFilterTexts(user), search));
}

/** Why "Add people" lists no one: everyone already has a color, or no one matches what was searched. */
export type AddPeopleEmpty = { kind: 'everyoneColored' } | { kind: 'noMatch'; search: string };

export function addPeopleEmpty(offered: readonly string[], search: string): AddPeopleEmpty {
  return offered.length === 0 ? { kind: 'everyoneColored' } : { kind: 'noMatch', search: search.trim() };
}

/** Everyone who made a changeset in `data`, each once. */
export function historyAuthors(data: BranchExplorerData): string[] {
  const authors = new Set<string>();
  for (const changeset of data.changesets) authors.add(changeset.owner);
  return [...authors];
}

/** The people who can be added: those in `authors` without a color yet, by name. */
export function usersToAdd(authors: readonly string[], colors: UserColors): string[] {
  const colored = new Set(colors.users.map((color) => color.user));
  return authors.filter((author) => !colored.has(author)).sort((a, b) => displayName(a).localeCompare(displayName(b)));
}

/** The hue of each changeset in `data` whose owner has a color. */
export function changesetUserHues(data: BranchExplorerData, colors: UserColors): ReadonlyMap<number, number> {
  const hues = new Map<number, number>();
  if (colors.users.length === 0) return hues;
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
