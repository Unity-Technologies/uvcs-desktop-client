import { useShownDiffFile } from '../../features/diff/shownDiffFile';
import type { Page } from '../navigation/pages';
import { shownFileOf, type ShownFile } from './shownLink';

/** The file the page shows now: what a link to the page names (`shownFileOf`). */
export function useShownFile(page: Page | undefined): ShownFile | null {
  return shownFileOf(page, useShownDiffFile((state) => state.shown));
}
