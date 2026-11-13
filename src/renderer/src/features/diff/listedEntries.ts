import type { DiffEntry } from '@shared/domain/diff';
import { withoutRepeatedFolders } from '../../lib/enclosingFolders';
import { hasMetaAlike } from '../../lib/unityMetaPairs';

/**
 * The entries a diff lists. A folder added or deleted along with files in it says nothing its files don't (a new
 * folder tree would fill the top of the list, and the diff open on "Directory · Added"), so only folders with nothing
 * listed under them stay, and moved ones: a move lists the folder alone (`withoutRepeatedFolders`). A folder whose
 * Unity `.meta` changed with it stays too, for the meta to ride on its row (`hasMetaAlike`, `pairDiffMetas`) rather
 * than show alone.
 */
export function listedEntries(entries: DiffEntry[]): DiffEntry[] {
  const keepsMeta = hasMetaAlike(entries, (entry) => entry.path, (entry) => entry.status);
  return withoutRepeatedFolders(entries, (entry) => entry.path, (entry) => entry.itemType !== 'directory' || entry.status === 'moved' || keepsMeta(entry));
}
