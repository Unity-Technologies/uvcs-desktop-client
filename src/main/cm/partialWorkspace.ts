/**
 * Makes a workspace just created partial, with nothing loaded (run in it): an update of no paths downloads nothing but
 * marks the workspace partial, on an empty repository too. Never a plain `cm update`, which loads everything and turns
 * a partial workspace back into a standard one.
 */
export const EMPTY_PARTIAL_UPDATE_ARGS: readonly string[] = ['partial', 'update', '--silent'];

/**
 * Loads only the chosen top folders in a partial workspace just created (run in it): `+/<folder>` loads a folder and
 * everything below it, and `cm` downloads them as it configures, so no `cm update` follows. `--silent` leaves out the
 * line it would print for every file it downloads.
 */
export function partialConfigureArgs(folders: readonly string[]): string[] {
  return ['partial', 'configure', ...folders.map((folder) => `+/${folder}`), '--silent'];
}

