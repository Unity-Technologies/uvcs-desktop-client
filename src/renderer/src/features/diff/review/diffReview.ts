import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import type { ReviewStatusOf } from '../../review/reviewStatus';

/** Path → the revision reviewed. */
export type DiffReviewMarks = ReadonlyMap<string, number>;

/**
 * What the marks of a diff are kept under. A branch is named without its head, so its marks survive new changesets
 * and tell which files changed since their review.
 */
export function diffReviewName(target: DiffTarget): string {
  switch (target.kind) {
    case 'changeset':
      return `cs:${target.changesetId}`;
    case 'branch':
      return `br:${target.branch}`;
    case 'shelve':
      return `sh:${target.shelveId}`;
    case 'range':
      return `${target.fromSpec}..${target.toSpec}`;
  }
}

/** A file in a diff is reviewed while the diff shows the revision that was reviewed; another one changed since. */
export function diffReviewStatusOf(marks: DiffReviewMarks): ReviewStatusOf<DiffEntry> {
  return (entry) => {
    if (entry.itemType === 'directory') return null;
    const reviewed = marks.get(entry.path);
    if (reviewed === undefined) return 'unreviewed';
    return reviewed === entry.revisionId ? 'reviewed' : 'changedSinceReview';
  };
}

/** The revision reviewed of a file changed since, to show just what changed after it; none when either side is missing. */
export function reviewedRevisionToCompare(marks: DiffReviewMarks, entry: DiffEntry): number | null {
  const reviewed = marks.get(entry.path);
  if (reviewed === undefined || reviewed === entry.revisionId || reviewed === -1 || entry.revisionId === -1) return null;
  return reviewed;
}
