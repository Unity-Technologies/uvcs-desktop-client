import { useShownDiffFile } from '../../features/diff/shownDiffFile';
import { useSelectedLines } from '../../features/diff/selectedLinesStore';
import { useShownRevision } from '../../features/history/shownRevision';
import type { Page } from '../navigation/pages';
import { shownFileOf, type ShownFile } from './shownLink';

/** The file the page shows now and the lines selected in it: what a link to the page names (`shownFileOf`). */
export function useShownFile(page: Page | undefined): ShownFile | null {
  const onScreen = useShownDiffFile((state) => state.shown);
  const selected = useSelectedLines((state) => state.selected);
  const revision = useShownRevision((state) => state.shown);
  return shownFileOf(page, onScreen, selected, revision);
}
