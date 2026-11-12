import type { Changeset } from '@shared/domain/changeset';
import { pluralizeAtLeast } from '../../lib/text';
import { authorNames } from './updatedMessage';

/**
 * How many rows show before the section scrolls: "All incoming changes" and three changesets. The files below are what
 * Incoming is for, so they start right under a few changesets and get the rest of the pane.
 */
export const INCOMING_ROWS_SHOWN = 4;

/**
 * Where "Show 200 more" goes, while older changesets remain to be read: above the oldest changeset shown, as the list
 * is oldest on top and the next page reads older ones. None once every one is read, or while the filter shows none.
 */
export function showMoreBeforeKey(shown: readonly Changeset[], more: boolean): string | undefined {
  const oldest = shown[0];
  return more && oldest ? String(oldest.id) : undefined;
}

/**
 * What the section's header says while it is closed: "3 changesets · Ana, Luis", from the changesets already read
 * (nothing more is asked of `cm`), "200+ changesets" while older ones remain to be read (`more`). Open, the rows say it.
 */
export function changesetsSummary(changesets: Changeset[], more: boolean): string {
  const authors = authorNames(changesets.map((changeset) => changeset.owner));
  return `${pluralizeAtLeast(changesets.length, more, 'changeset')}${authors ? ` · ${authors}` : ''}`;
}
