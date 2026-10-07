import type { Changeset } from '@shared/domain/changeset';
import type { BranchIncomingChanges, IncomingChangesetPage } from '@shared/domain/incoming';

/** Where "Show more" starts: older than the oldest changeset the incoming changes read (`changesetid <` it). */
export function firstOlderPageParam({ changesets, headChangeset }: Pick<BranchIncomingChanges, 'changesets' | 'headChangeset'>): number {
  return changesets.at(-1)?.id ?? headChangeset;
}

/** Where the page after `page` starts, or undefined once it said no older ones remain. */
export function nextOlderPageParam(page: IncomingChangesetPage): number | undefined {
  return page.more ? page.changesets.at(-1)?.id : undefined;
}

/**
 * Incoming's changesets as read so far, newest first: the first page the incoming changes brought, then each older page
 * read. Whether more remain is what the last page read says.
 */
export function listedIncomingChangesets(
  first: Pick<BranchIncomingChanges, 'changesets' | 'moreChangesets'>,
  pages: readonly IncomingChangesetPage[],
): { changesets: Changeset[]; more: boolean } {
  const last = pages.at(-1);
  if (!last) return { changesets: first.changesets, more: first.moreChangesets };
  return { changesets: [...first.changesets, ...pages.flatMap((page) => page.changesets)], more: last.more };
}

/**
 * What "Show more" reads, decided from what the cache holds rather than from the list's own state, which a visit to
 * another view resets while the pages read stay: the page after the last one read, or the first older page while
 * none is (never asked for, or it failed).
 */
export function showMoreStep(pages: readonly IncomingChangesetPage[] | undefined): 'nextPage' | 'firstPage' {
  return pages && pages.length > 0 ? 'nextPage' : 'firstPage';
}

/**
 * The changeset the arrows go on from after Enter on "Show more": the first of the page that landed at `landingAt` (how
 * many changesets the list had when it was asked for); null while none is awaited or it hasn't landed.
 */
export function landingSelection(changesets: readonly Changeset[], landingAt: number | null): Changeset | null {
  return landingAt !== null && changesets.length > landingAt ? changesets[landingAt]! : null;
}
