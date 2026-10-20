import { mergeSourcePoint, type FileConflict, type MergeRequest } from '@shared/domain/merge';
import { spec } from '@shared/domain/specs';

// The specs `cm cat` saves a conflicting file's kept version by: the item at a contributor's point, in the repository
// the plan names for it (an xlinked one's own, where the same numbers are another item).

/** The incoming version: the item at the source's changeset, or a shelve's in the shelve, whose revisions no changeset holds. */
export function sourceVersionSpec(request: MergeRequest, conflict: FileConflict): string {
  return spec.itemAt(conflict.itemId, mergeSourcePoint(request, conflict.sourceChangeset), conflict.repository);
}

/** The common ancestor's version: the item at the base's changeset. */
export function baseVersionSpec(conflict: FileConflict): string {
  return spec.itemAt(conflict.itemId, spec.changeset(conflict.baseChangeset), conflict.repository);
}

/** A file added on both sides has no common ancestor: `cm` prints a negative base changeset for it. */
export function hasBase(conflict: FileConflict): boolean {
  return conflict.baseChangeset >= 0;
}
