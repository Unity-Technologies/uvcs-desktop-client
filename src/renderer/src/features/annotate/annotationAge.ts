import type { AnnotationChangeset } from '@shared/domain/annotate';

/** How many shades the age strip and its legend have, oldest (1) to newest. */
export const AGE_BUCKETS = 5;

/**
 * 0 for the oldest changeset in the file, 1 for the newest. Ranks changesets by date rather than scaling by time, so one
 * very old line doesn't wash out the rest; a file of one changeset reads as newest.
 */
export function recencyByChangeset(changesets: readonly AnnotationChangeset[]): Map<number, number> {
  const byDate = [...changesets].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.changesetId - b.changesetId);
  const steps = Math.max(1, byDate.length - 1);
  return new Map(byDate.map((changeset, rank) => [changeset.changesetId, byDate.length === 1 ? 1 : rank / steps]));
}

/** The shade of a recency: 1 (oldest) to `AGE_BUCKETS` (newest), in equal steps. */
export function ageBucket(recency: number): number {
  const clamped = Math.min(1, Math.max(0, recency));
  return 1 + Math.min(AGE_BUCKETS - 1, Math.floor(clamped * AGE_BUCKETS));
}
