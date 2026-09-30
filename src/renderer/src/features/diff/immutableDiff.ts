import type { DiffTarget } from '@shared/domain/diff';

/**
 * Whether the files a diff lists never change once read, so they're cached as immutable (`IMMUTABLE_QUERY`): history
 * doesn't change once written, nor does a shelve, nor a branch read at a given head (`branchHead`). A branch without
 * its head refreshes with the workspace.
 */
export function isImmutableDiff(target: DiffTarget | null, branchHead: number | undefined): boolean {
  return target?.kind === 'changeset' || target?.kind === 'range' || target?.kind === 'shelve' || branchHead !== undefined;
}
