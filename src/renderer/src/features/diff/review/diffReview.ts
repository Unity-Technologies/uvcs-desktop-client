import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import type { BranchGuid } from '@shared/domain/stableIds';
import type { ReviewStatusOf } from '../../review/reviewStatus';

/** Path → the revision reviewed. */
export type DiffReviewMarks = ReadonlyMap<string, number>;

/**
 * What the marks of a diff are kept under. A branch is named by its GUID, without its head, so its marks survive a
 * rename made anywhere and new changesets, and tell which files changed since their review: none while its GUID
 * isn't known.
 */
export function diffReviewName(target: DiffTarget, branchGuid: BranchGuid | undefined): string | undefined {
  switch (target.kind) {
    case 'changeset':
      return `cs:${target.changesetId}`;
    case 'branch':
      return branchGuid && `br:${branchGuid}`;
    case 'shelve':
      return `sh:${target.shelveId}`;
    case 'range':
      return `${target.fromSpec}..${target.toSpec}`;
  }
}

/** What a diff's marks were kept under before: a branch's by its name, until they move under its GUID. */
export function formerDiffReviewName(target: DiffTarget): string | undefined {
  return target.kind === 'branch' ? `br:${target.branch}` : undefined;
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
