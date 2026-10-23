import type { ContentSource } from '@shared/domain/content';
import { mergeSourcePoint, type ConflictSide, type DirectoryConflict, type MergeContributors, type MergeRequest } from '@shared/domain/merge';
import { spec } from '@shared/domain/specs';
import type { MergeLabels } from '../mergeDescription';

/** What a directory conflict's incoming side is compared with: yours (the destination) or the common ancestor. */
export type DirectoryConflictComparison = 'destination' | 'base';

export interface ComparedVersions {
  /** Yours or the base: the older side of the diff. */
  original: ContentSource;
  /** The incoming side. */
  modified: ContentSource;
}

/**
 * The comparisons a directory conflict offers: incoming with yours, and with the base when the plan names one. None
 * for a folder (it has no content to diff), an xlink (its target isn't a file), or a plan that didn't name the merge's
 * changesets (`MergePlan.contributors`), whose versions can't be read.
 */
export function comparisonsOf(conflict: DirectoryConflict, contributors: MergeContributors | undefined): DirectoryConflictComparison[] {
  if (conflict.isDirectory || conflict.type === 'xlink' || !contributors) return [];
  return contributors.base ? ['destination', 'base'] : ['destination'];
}

/**
 * The versions a comparison diffs: the incoming item at the source's point against yours at the destination's
 * changeset, or against the item at the base's changeset, where it was before either side touched it. A side that
 * deleted the item, or a base the incoming item didn't exist in yet (it was added: two items with the same name),
 * is empty. Only for a comparison `comparisonsOf` offers.
 */
export function comparedVersions(
  conflict: DirectoryConflict,
  comparison: DirectoryConflictComparison,
  contributors: MergeContributors,
  request: MergeRequest,
): ComparedVersions {
  const modified = sideVersion(conflict.source, mergeSourcePoint(request, contributors.source.changesetId));
  if (comparison === 'destination') return { original: sideVersion(conflict.destination, spec.changeset(contributors.destination.changesetId)), modified };
  return { original: baseVersion(conflict.source, spec.changeset(contributors.base?.changesetId ?? contributors.destination.changesetId)), modified };
}

/** "Incoming ↔ Yours" and "Incoming ↔ Base", in the merge's words ("Source ↔ Destination" into a server branch). */
export function comparisonSegments(comparisons: DirectoryConflictComparison[], labels: MergeLabels): { value: DirectoryConflictComparison; label: string; title: string }[] {
  const { source, destination } = labels.roles;
  return comparisons.map((comparison) =>
    comparison === 'destination'
      ? { value: comparison, label: `${source.name} ↔ ${destination.name}`, title: `${labels.source} against ${labels.destination}` }
      : { value: comparison, label: `${source.name} ↔ Base`, title: `${labels.source} against the common ancestor` },
  );
}

function sideVersion(side: ConflictSide, pointSpec: string): ContentSource {
  return side.operation === 'deleted' ? { kind: 'empty' } : { kind: 'repositoryPath', path: side.path, at: pointSpec };
}

/** The incoming item where the base had it: before a move, at its old path. */
function baseVersion(source: ConflictSide, baseSpec: string): ContentSource {
  return source.operation === 'added' ? { kind: 'empty' } : { kind: 'repositoryPath', path: source.oldPath ?? source.path, at: baseSpec };
}
