import type { MemberRef } from '@shared/domain/member';
import { displayName, userFilterTexts } from '../../lib/userName';

/**
 * The server's groups (`cm listusers --onlygroups`, read once and kept, `useReviewerGroups`), by name whatever its
 * case: which reviewers are groups. `cm find review` prints a reviewer's name only (`{reviewers}`, `name:Status`), the
 * same for a user and a group, and `cm codereview reviewer list`, which tells them apart, reads one review at a time.
 * A server that lists no groups (one that takes the names its system knows) has its groups read as users.
 */
export type ReviewerGroups = ReadonlySet<string>;

export const NO_GROUPS: ReviewerGroups = new Set();

export function reviewerGroups(groupNames: readonly string[]): ReviewerGroups {
  return new Set(groupNames.map((name) => name.toLowerCase()));
}

export function isGroup(name: string, groups: ReviewerGroups): boolean {
  return groups.has(name.toLowerCase());
}

/** A reviewer as `cm` takes them: a group (`--groups`) when the server lists one by that name, a user (`--users`) otherwise. */
export function reviewerRef(name: string, groups: ReviewerGroups): MemberRef {
  return { name, kind: isGroup(name, groups) ? 'group' : 'user' };
}

/** The reviewers typed into one field, split at commas (`ana, Developers` asks both), once each, groups as groups. */
export function typedReviewers(typed: string, groups: ReviewerGroups): MemberRef[] {
  const names = [...new Set(typed.split(',').map((name) => name.trim()).filter(Boolean))];
  return names.map((name) => reviewerRef(name, groups));
}

/** How a reviewer is named: a user by the name shown for them (`jane.doe@acme.com`, Jane Doe), a group as the server names it. */
export function reviewerLabel(name: string, groups: ReviewerGroups): string {
  return isGroup(name, groups) ? name : displayName(name);
}

/** What a search matches a reviewer by: a group by its name, a user by the name shown and as stored. */
export function reviewerFilterTexts(name: string, groups: ReviewerGroups): string[] {
  return isGroup(name, groups) ? [name] : userFilterTexts(name);
}
