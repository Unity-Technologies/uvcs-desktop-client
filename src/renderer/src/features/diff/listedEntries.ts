import type { DiffEntry } from '@shared/domain/diff';

/**
 * The entries a diff lists. A folder added or deleted along with files in it says nothing its files don't (a new
 * folder tree would fill the top of the list, and the diff open on "Directory · Added"), so only folders with nothing
 * listed under them stay, and moved ones: a move lists the folder alone.
 */
export function listedEntries(entries: DiffEntry[]): DiffEntry[] {
  const enclosing = new Set<string>();
  for (const { path } of entries) {
    for (let end = path.lastIndexOf('/'); end > 0; end = path.lastIndexOf('/', end - 1)) enclosing.add(path.slice(0, end));
  }
  return entries.filter((entry) => entry.itemType !== 'directory' || entry.status === 'moved' || !enclosing.has(entry.path));
}
