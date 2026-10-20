import type { ContentSource } from '@shared/domain/content';
import { mergeSourcePoint, type MergeChange, type MergeContributors, type MergeRequest } from '@shared/domain/merge';
import { spec } from '@shared/domain/specs';

/**
 * What the merge page previews for a change that applies cleanly: the version before against the version it leads
 * to (`diff`), a note that only its permissions change, or, when the plan didn't name the merge's source and
 * destination changesets (`MergePlan.contributors`), what the merge will do without its versions (`noVersions`).
 */
export type ChangePreview = { kind: 'permissionsOnly' } | { kind: 'noVersions' } | { kind: 'diff'; original: ContentSource; modified: ContentSource };

export function changePreviewOf(change: MergeChange, contributors: MergeContributors | undefined, request: MergeRequest): ChangePreview {
  if (change.kind === 'permissions') return { kind: 'permissionsOnly' };
  if (!contributors) return { kind: 'noVersions' };
  return { kind: 'diff', ...versionsToCompare(change, contributors, request) };
}

function versionsToCompare(change: MergeChange, contributors: MergeContributors, request: MergeRequest): { original: ContentSource; modified: ContentSource } {
  const source = mergeSourcePoint(request, contributors.source.changesetId);
  const destination = spec.changeset(contributors.destination.changesetId);
  const ancestor = spec.changeset(contributors.base?.changesetId ?? contributors.destination.changesetId);
  const at = (path: string, pointSpec: string): ContentSource => ({ kind: 'repositoryPath', path, at: pointSpec });

  // Undoing a changeset takes the destination back to the ancestor's content.
  if (request.kind === 'subtractive' && (change.kind === 'changed' || change.kind === 'moved')) {
    return { original: at(change.oldPath ?? change.path, destination), modified: at(change.path, ancestor) };
  }

  switch (change.kind) {
    case 'added':
      return { original: { kind: 'empty' }, modified: at(change.path, source) };
    case 'deleted':
      return { original: at(change.path, destination), modified: { kind: 'empty' } };
    default:
      return { original: at(change.oldPath ?? change.path, ancestor), modified: at(change.path, source) };
  }
}
