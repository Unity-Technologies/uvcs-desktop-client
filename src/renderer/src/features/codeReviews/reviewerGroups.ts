import type { CodeReviewer } from '@shared/domain/codeReview';
import type { MemberRef } from '@shared/domain/member';
import { displayName, userFilterTexts } from '../../lib/userName';

/**
 * The server's groups (`cm listusers --onlygroups`, read once and kept, `useReviewerGroups`), by name whatever its
 * case: which reviewers of no known type are groups. `cm find review` prints a reviewer's name only (`{reviewers}`,
 * `name:Status`), the same for a user and a group; `cm codereview reviewer list` types each (`CodeReviewer.kind`) but
 * reads one review at a time, so only the review's page has it (`useReviewersOf`). A server that lists no groups (one
 * that takes the names its system knows) has the groups of a list read as users.
 */
export type ReviewerGroups = ReadonlySet<string>;

export const NO_GROUPS: ReviewerGroups = new Set();

/** A reviewer, or a name to ask: its type when `cm` gave it. */
export type NamedReviewer = Pick<CodeReviewer, 'name' | 'kind'>;

export function reviewerGroups(groupNames: readonly string[]): ReviewerGroups {
  return new Set(groupNames.map((name) => name.toLowerCase()));
}

/** Whether a reviewer is a group: as `cm` typed them when it did, else as the server's groups say. */
export function isGroup({ name, kind }: NamedReviewer, groups: ReviewerGroups): boolean {
  return kind ? kind === 'group' : groups.has(name.toLowerCase());
}

/** A reviewer as `cm` takes them: a group in `--groups`, a user in `--users`. */
export function reviewerRef(reviewer: NamedReviewer, groups: ReviewerGroups): MemberRef {
  return { name: reviewer.name, kind: isGroup(reviewer, groups) ? 'group' : 'user' };
}

/** The reviewers typed into one field, split at commas (`ana, Developers` asks both), once each, groups as groups. */
export function typedReviewers(typed: string, groups: ReviewerGroups): MemberRef[] {
  const names = [...new Set(typed.split(',').map((name) => name.trim()).filter(Boolean))];
  return names.map((name) => reviewerRef({ name }, groups));
}

/** How a reviewer is named: a user by the name shown for them (`jane.doe@acme.com`, Jane Doe), a group as the server names it. */
export function reviewerLabel(reviewer: NamedReviewer, groups: ReviewerGroups): string {
  return isGroup(reviewer, groups) ? reviewer.name : displayName(reviewer.name);
}

/** What a search matches a reviewer by: a group by its name, a user by the name shown and as stored. */
export function reviewerFilterTexts(name: string, groups: ReviewerGroups): string[] {
  return isGroup({ name }, groups) ? [name] : userFilterTexts(name);
}
