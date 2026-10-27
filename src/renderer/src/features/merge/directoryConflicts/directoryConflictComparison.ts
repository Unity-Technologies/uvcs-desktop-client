import type { ContentSource } from '@shared/domain/content';
import { mergeSourcePoint, type ConflictSide, type DirectoryConflict, type MergeContributors, type MergeRequest } from '@shared/domain/merge';
import { spec } from '@shared/domain/specs';
import { ONLY_MOVED } from '../../diff/viewer/movedFrom';
import type { MergeLabels } from '../mergeDescription';

/** What a directory conflict's incoming side is compared with: yours (the destination) or the common ancestor. */
export type DirectoryConflictComparison = 'destination' | 'base';

/** The comparison a directory conflict opens on: what the user is choosing between. */
export const FIRST_COMPARISON: DirectoryConflictComparison = 'destination';

export interface ComparedVersions {
  /** Yours or the base: the older side of the diff. */
  original: ContentSource;
  /** The incoming side. */
  modified: ContentSource;
  /** The path the diff's header names: the incoming item's, or the other side's where the incoming one deleted it. */
  path: string;
  /** The other side's path where it differs (a move on either side), which the header's tooltip shows. */
  oldPath?: string;
}

/**
 * The comparisons a directory conflict offers: incoming with yours, and with the base where it shows what the
 * incoming side did. None for a folder (it has no content to diff), an xlink (its target isn't a file), or a plan that
 * didn't name the merge's changesets (`MergePlan.contributors`), whose versions can't be read. No base for an incoming
 * item that was added (the base has nothing: the diff would be the whole file again), nor outside a merge: undoing a
 * changeset, `cm` takes the changeset undone as the base, and cherry picking, the picked changeset's parent, neither
 * an ancestor both sides share.
 */
export function comparisonsOf(conflict: DirectoryConflict, contributors: MergeContributors | undefined, request: MergeRequest): DirectoryConflictComparison[] {
  if (conflict.isDirectory || conflict.type === 'xlink' || !contributors) return [];
  const offersBase = request.kind === 'merge' && contributors.base !== undefined && conflict.source.operation !== 'added';
  return offersBase ? ['destination', 'base'] : ['destination'];
}

/**
 * The versions a comparison diffs: the incoming item at the source's point against yours at the destination's
 * changeset, or against the item at the base's changeset, where it was before either side touched it. Each is read by
 * its path, as `cm merge` prints it: a directory conflict names no repository, so an item id could name another item
 * under an xlink. A side that deleted the item is empty. Only for a comparison `comparisonsOf` offers.
 */
export function comparedVersions(
  conflict: DirectoryConflict,
  comparison: DirectoryConflictComparison,
  contributors: MergeContributors,
  request: MergeRequest,
): ComparedVersions {
  const { source, destination } = conflict;
  const modified = sideVersion(source, mergeSourcePoint(request, contributors.source.changesetId));
  const [original, originalPath] =
    comparison === 'destination'
      ? [sideVersion(destination, spec.changeset(contributors.destination.changesetId)), destination.path]
      : [baseVersion(source, spec.changeset(contributors.base?.changesetId ?? contributors.destination.changesetId)), source.oldPath ?? source.path];
  const path = source.operation === 'deleted' ? originalPath : source.path;
  return { original, modified, path, ...(originalPath !== path && { oldPath: originalPath }) };
}

/**
 * The switch between the comparisons, "Incoming ↔ Yours" and "Incoming ↔ Base" in the merge's words ("Source ↔
 * Destination" into a server branch); none with only one to show.
 */
export function comparisonSegments(comparisons: DirectoryConflictComparison[], labels: MergeLabels): { value: DirectoryConflictComparison; label: string; title: string }[] {
  if (comparisons.length < 2) return [];
  const { source, destination } = labels.roles;
  return comparisons.map((comparison) =>
    comparison === 'destination'
      ? { value: comparison, label: `${source.name} ↔ ${destination.name}`, title: `${labels.source} against ${labels.destination}` }
      : { value: comparison, label: `${source.name} ↔ Base`, title: `${labels.source} against the common ancestor` },
  );
}

/**
 * Why a comparison may find both versions the same: compared with the base, an incoming move that kept the content.
 * Otherwise the diff's own words ("The contents of both versions are identical").
 */
export function identicalNoteOf(conflict: DirectoryConflict, comparison: DirectoryConflictComparison): string | undefined {
  return comparison === 'base' && conflict.source.operation === 'moved' ? ONLY_MOVED : undefined;
}

function sideVersion(side: ConflictSide, pointSpec: string): ContentSource {
  return side.operation === 'deleted' ? { kind: 'empty' } : { kind: 'repositoryPath', path: side.path, at: pointSpec };
}

/**
 * The incoming item where the base had it: before a move, at its old path. A folder above it that moved too isn't
 * followed: the read finds nothing there and the diff says it couldn't load.
 */
function baseVersion(source: ConflictSide, baseSpec: string): ContentSource {
  return { kind: 'repositoryPath', path: source.oldPath ?? source.path, at: baseSpec };
}
