import { hidesEveryRow } from '../../lib/hidesEveryRow';

/**
 * What a diff's second pane shows beside its list of files: `blank` while the files are read, while filters hide
 * every one (nothing can be selected) or until one is selected; `noDifferences` when the diff lists none; `entry`, the
 * diff of the file selected; `folder`, what the folder selected in a tree holds.
 */
export type DiffPane = 'blank' | 'noDifferences' | 'entry' | 'folder';

interface DiffPaneInput {
  /** The files the diff lists (`listedEntries`); undefined while they're read. */
  listedCount: number | undefined;
  /** How many of them the filter and review mode show. */
  shownCount: number;
  entrySelected: boolean;
  folderSelected: boolean;
}

export function diffPaneOf({ listedCount, shownCount, entrySelected, folderSelected }: DiffPaneInput): DiffPane {
  if (listedCount === undefined || hidesEveryRow(listedCount, shownCount)) return 'blank';
  if (listedCount === 0) return 'noDifferences';
  if (entrySelected) return 'entry';
  return folderSelected ? 'folder' : 'blank';
}
