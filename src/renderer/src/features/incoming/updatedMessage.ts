import type { BranchIncomingChanges } from '@shared/domain/incoming';
import { pluralize } from '../../lib/text';
import { displayName } from '../../lib/userName';

const NAMED_AUTHORS = 3;

/** "Updated to cs:14 · 3 changesets from Ana, Bob" — what an update brought in, and from whom. */
export function updatedMessage(incoming: BranchIncomingChanges): string {
  return `Updated to cs:${incoming.headChangeset} · ${changesetsFrom(incoming.changesets.length, incoming.changesets.map((changeset) => changeset.owner))}`;
}

/** "3 changesets from Ana, Bob", naming each author once. */
export function changesetsFrom(count: number, owners: string[]): string {
  const authors = authorNames(owners);
  return `${pluralize(count, 'changeset')}${authors ? ` from ${authors}` : ''}`;
}

/** "Ana, Bob and 2 more": each author once, by name, the first few; empty without any. */
export function authorNames(owners: string[]): string {
  const authors = [...new Set(owners.map(displayName))];
  const named = authors.slice(0, NAMED_AUTHORS).join(', ');
  const others = authors.length - NAMED_AUTHORS;
  return others > 0 ? `${named} and ${others} more` : named;
}
