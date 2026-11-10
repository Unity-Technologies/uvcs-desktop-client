import type { WorkspaceKind } from '@shared/domain/workspace';

/**
 * `cm shelveset create` of the given items (every pending change when none), with the comment read from a file. Given
 * paths, `--dependencies` takes the added folders above them too, as a check-in does (`checkinArgs`).
 *
 * A partial workspace refuses the regular command ("The workspace is in Gluon format"): it shelves with
 * `cm partial shelveset create`, which has no `--all` nor `--dependencies`. `--applychanged` takes the files changed
 * but not checked out, as `--all` does, and the paths are taken with everything under them.
 */
export function shelveCreateArgs(targets: readonly string[], commentsFile: string, kind: WorkspaceKind): string[] {
  const comments = `-commentsfile=${commentsFile}`;
  if (kind === 'partial') return ['partial', 'shelveset', 'create', ...targets, '--applychanged', comments];
  const dependencies = targets.length > 0 ? ['--dependencies'] : [];
  return ['shelveset', 'create', ...targets, '--all', ...dependencies, comments];
}
