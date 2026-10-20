import { hidesEveryRow } from '../../lib/hidesEveryRow';

/**
 * What a diff's second pane shows beside its list of files: `blank` while the files are read or until one is
 * selected; `noMatches` while filters hide every file, the pane blank (nothing can be selected) and the list saying
 * so; `noDifferences` when the diff lists none; `entry`, the diff of the file selected; `folder`, what the folder
 * selected in a tree holds.
 */
export type DiffPane = 'blank' | 'noMatches' | 'noDifferences' | 'entry' | 'folder';

interface DiffPaneInput {
  /** The files the diff lists (`listedEntries`); undefined while they're read. */
  listedCount: number | undefined;
  /** How many of them the filter and review mode show. */
  shownCount: number;
  entrySelected: boolean;
  folderSelected: boolean;
}

export function diffPaneOf({ listedCount, shownCount, entrySelected, folderSelected }: DiffPaneInput): DiffPane {
  if (listedCount === undefined) return 'blank';
  if (hidesEveryRow(listedCount, shownCount)) return 'noMatches';
  if (listedCount === 0) return 'noDifferences';
  if (entrySelected) return 'entry';
  return folderSelected ? 'folder' : 'blank';
}
