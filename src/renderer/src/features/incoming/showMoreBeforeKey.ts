import type { Changeset } from '@shared/domain/changeset';

/**
 * Where "Show 200 more" goes, while older changesets remain to be read: above the oldest changeset shown, as the list
 * is oldest on top and the next page reads older ones. None once every one is read, or while the filter shows none.
 */
export function showMoreBeforeKey(shown: readonly Changeset[], more: boolean): string | undefined {
  const oldest = shown[0];
  return more && oldest ? String(oldest.id) : undefined;
}

