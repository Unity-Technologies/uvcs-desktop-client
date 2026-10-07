import type { DiffEntry } from '@shared/domain/diff';
import { withoutRepeatedFolders } from '../../lib/enclosingFolders';

/**
 * The entries a diff lists. A folder added or deleted along with files in it says nothing its files don't (a new
 * folder tree would fill the top of the list, and the diff open on "Directory · Added"), so only folders with nothing
 * listed under them stay, and moved ones: a move lists the folder alone (`withoutRepeatedFolders`).
 */
export function listedEntries(entries: DiffEntry[]): DiffEntry[] {
  return withoutRepeatedFolders(entries, (entry) => entry.path, (entry) => entry.itemType !== 'directory' || entry.status === 'moved');
}
