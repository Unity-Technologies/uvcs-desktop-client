import type { ItemRevision } from '@shared/domain/history';
import { displayName } from '../../lib/userName';

/** Whether a revision matches the history filter: its changeset number, comment, author or branch contains the text. */
export function matchesRevisionSearch(revision: ItemRevision, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return [String(revision.changesetId), revision.comment, revision.owner, displayName(revision.owner), revision.branch].some((field) =>
    field.toLowerCase().includes(needle),
  );
}
