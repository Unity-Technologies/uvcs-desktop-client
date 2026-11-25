import { useShownBrowseItem } from '../../features/browseRepository/shownBrowseItem';
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
  const browsed = useShownBrowseItem((state) => state.shown);
  return shownFileOf(page, onScreen, selected, revision, browsed);
}

/**
 * The file the page shows now, with `picked` lines of it as if they were selected: what a link to lines the lines' menu
 * acts on names, though a right-click leaves the selection as it was.
 */
export function shownFileWithLines(page: Page | undefined, picked: Required<Omit<ShownFile, 'revision'>>): ShownFile | null {
  return shownFileOf(page, useShownDiffFile.getState().shown, picked, useShownRevision.getState().shown, useShownBrowseItem.getState().shown);
}

/** The same, read once (a command running), so nothing re-renders as the selection moves. */
export function shownFileNow(page: Page | undefined): ShownFile | null {
  return shownFileOf(page, useShownDiffFile.getState().shown, useSelectedLines.getState().selected, useShownRevision.getState().shown, useShownBrowseItem.getState().shown);
}
