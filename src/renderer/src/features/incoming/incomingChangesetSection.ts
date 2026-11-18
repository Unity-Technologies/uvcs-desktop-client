import type { Changeset } from '@shared/domain/changeset';
import { authorNames } from './updatedMessage';

/**
 * Where "Show 200 more" goes, while older changesets remain to be read: above the oldest changeset shown, as the list
 * is oldest on top and the next page reads older ones. None once every one is read, or while the filter shows none.
 */
export function showMoreBeforeKey(shown: readonly Changeset[], more: boolean): string | undefined {
  const oldest = shown[0];
  return more && oldest ? String(oldest.id) : undefined;
}

/**
 * Who the changesets came from, after the folded "All incoming changes" row: "from Ana, Luis", from the changesets
 * already read (nothing more is asked of `cm`). How many came in, the header says. Open, the rows say it all.
 */
export function foldedChangesetsAuthors(changesets: readonly Changeset[]): string {
  const authors = authorNames(changesets.map((changeset) => changeset.owner));
  return authors ? `from ${authors}` : '';
}
