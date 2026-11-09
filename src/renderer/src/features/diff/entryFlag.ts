import type { LucideIcon } from 'lucide-react';
import { createContext } from 'react';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import type { ListFlag } from '../../components/useChangeFilter';

/**
 * What a place flags among a `DiffBrowser`'s files: a review its files with comments. Each flagged file's row shows
 * the flag's icon by its status letter (`ItemMark`), and the list's filter a chip showing only them, where the place
 * names one.
 */
export interface EntryFlag {
  icon: LucideIcon;
  /** What the mark says of a file of `target`'s diff ("2 comments"); null for a file it doesn't flag. */
  markOf: (target: DiffTarget) => (entry: DiffEntry) => string | null;
  /** The filter chip's name ("Commented"); no chip where showing only the flagged files says nothing. */
  filterLabel?: string;
}

export const EntryFlagContext = createContext<EntryFlag | null>(null);

/**
 * The list filter's chip for a place's flag on a diff (`markOf`, the flag's marks there): the files it flags are those
 * with a mark. None where the place names no chip.
 */
export function entryFlagChip(flag: Pick<EntryFlag, 'icon' | 'filterLabel'>, markOf: (entry: DiffEntry) => string | null): ListFlag<DiffEntry> | undefined {
  return flag.filterLabel ? { icon: flag.icon, label: flag.filterLabel, holds: (entry) => markOf(entry) !== null } : undefined;
}
