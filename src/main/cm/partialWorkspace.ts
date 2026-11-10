/**
 * Loads only the chosen top folders in a partial workspace just created (run in it): `+/<folder>` loads a folder and
 * everything below it, and `cm` downloads them as it configures, so no `cm update` follows. `--silent` leaves out the
 * line it would print for every file it downloads.
 */
export function partialConfigureArgs(folders: readonly string[]): string[] {
  return ['partial', 'configure', ...folders.map((folder) => `+/${folder}`), '--silent'];
}

