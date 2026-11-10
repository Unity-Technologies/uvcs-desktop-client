import type { PartialRule } from '@shared/domain/workspace';

/**
 * Makes a workspace just created partial, with nothing loaded (run in it): an update of no paths downloads nothing but
 * marks the workspace partial, on an empty repository too. Never a plain `cm update`, which loads everything and turns
 * a partial workspace back into a standard one.
 */
export const EMPTY_PARTIAL_UPDATE_ARGS: readonly string[] = ['partial', 'update', '--silent'];

/**
 * Changes what a partial workspace has loaded (run in it): `+/<path>` loads a file or a folder and everything below it
 * (the folders above it too), `-/<path>` removes it from the disk. `cm` downloads and deletes as it configures, so no
 * `cm update` follows. One rule `cm` refuses (a path not found, something already loaded or not loaded) fails the
 * whole command and nothing changes. `--silent` leaves out the line it would print for every file.
 */
export function partialConfigureArgs(rules: readonly PartialRule[]): string[] {
  return ['partial', 'configure', ...rules.map(({ path, load }) => `${load ? '+' : '-'}/${path}`), '--silent'];
}

/**
 * Updates a partial workspace (run in it) and keeps it partial: it brings what it holds up to date, new items in its
 * folders too, and downloads nothing else. It prints no line per file, so its progress can't be shown. `--dontmerge`
 * stops it, as `UPDATE_ARGS` does, when local changes collide with incoming ones.
 */
export const PARTIAL_UPDATE_ARGS: readonly string[] = ['partial', 'update', '--dontmerge'];
