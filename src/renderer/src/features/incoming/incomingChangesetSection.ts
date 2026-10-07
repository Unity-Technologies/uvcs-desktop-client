import type { Changeset } from '@shared/domain/changeset';
import { pluralizeAtLeast } from '../../lib/text';
import { authorNames } from './updatedMessage';

/** The heights the section's rows are drawn at: "All incoming changes", and a changeset (comment, then author and date). */
export const ALL_ROW_HEIGHT = 30;
export const CHANGESET_ROW_HEIGHT = 49;

/**
 * How many changesets show before the section scrolls: the files below are what Incoming is for, so they start right
 * under a few changesets and get the rest of the pane.
 */
export const CHANGESETS_SHOWN = 3;

/** The tallest the section's rows get: "All incoming changes" and `shown` changesets; more scroll inside it. */
export function changesetListMaxHeight(shown = CHANGESETS_SHOWN): number {
  return ALL_ROW_HEIGHT + shown * CHANGESET_ROW_HEIGHT;
}

/**
 * What the section's header says while it is closed: "3 changesets · Ana, Luis", from the changesets already read
 * (nothing more is asked of `cm`), "200+ changesets" while older ones remain to be read (`more`). Open, the rows say it.
 */
export function changesetsSummary(changesets: Changeset[], more: boolean): string {
  const authors = authorNames(changesets.map((changeset) => changeset.owner));
  return `${pluralizeAtLeast(changesets.length, more, 'changeset')}${authors ? ` · ${authors}` : ''}`;
}
