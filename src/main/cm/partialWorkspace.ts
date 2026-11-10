import { recordFormat, type ReadRecord } from './formatRecords';
import { readListedPath } from './repositoryPaths';

/**
 * Loads only the chosen top folders in a partial workspace just created (run in it): `+/<folder>` loads a folder and
 * everything below it, and `cm` downloads them as it configures, so no `cm update` follows. `--silent` leaves out the
 * line it would print for every file it downloads.
 */
export function partialConfigureArgs(folders: readonly string[]): string[] {
  return ['partial', 'configure', ...folders.map((folder) => `+/${folder}`), '--silent'];
}

/**
 * The items at the root of the repository's /main, their type and path only: one `cm ls` without `-R`, so it costs
 * the root's items, never the whole tree. The New workspace dialog offers the folders it finds to load.
 */
export function topFoldersArgs(repository: string): string[] {
  return ['ls', '/', `--tree=br:/main@${repository}`, `--format=${recordFormat(['type', 'path'])}`];
}

/** One record of `topFoldersArgs`: a folder's (or an xlink's) name; none for the root itself or a file. */
export const readTopFolder: ReadRecord<string> = (fields) => {
  const listed = readListedPath(fields);
  return listed?.isDirectory ? listed.path : undefined;
};
