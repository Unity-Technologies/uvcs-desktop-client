import { createContext } from 'react';
import type { LinkTarget } from '../../../app/links/linkNavigation';
import type { FocusedLines } from '../../../app/navigation/pages';
import type { SelectedLines } from '../selectedLinesStore';

/**
 * What a diff's lines do for links (docs/features/deep-links.md), given by the place the diff shows in:
 * - `focus`: the lines a link opened the page on (`#L42`), in that file (a repository path, as `DiffEntry.path`):
 *   the file's diff opens scrolled to them, marked;
 * - `publishes`: the lines selected in its gutter are the ones "Copy link" names (`selectedLinesStore`): a committed
 *   diff's (`DiffBrowser`) and a history's (`HistoryPage`, its diff and annotations), not a workspace's own changes,
 *   which no link names.
 * Without one (a merge's diff), lines can still be selected, for nothing but to look at them.
 */
export interface LineLinks {
  focus: SelectedLines | null;
  publishes: boolean;
  /** Opens the file annotated at lines of the diff's newer side, where it can be annotated (the lines' menu). */
  annotateAt?: (lines: FocusedLines) => void;
  /**
   * The link to lines selected where the code shows in no page (the Files view, `filesItemLink`), which the line chip
   * and the lines' menu copy; a page's lines are named by the page (`pageLinkTarget`).
   */
  linkOf?: (lines: FocusedLines) => LinkTarget | null;
}

export const LineLinksContext = createContext<LineLinks | null>(null);

/** A file of `path` opens on these lines when the link's lines are of it. */
export function focusIn(lineLinks: LineLinks | null, path: string): SelectedLines['lines'] | undefined {
  return lineLinks?.focus?.path === path ? lineLinks.focus.lines : undefined;
}
