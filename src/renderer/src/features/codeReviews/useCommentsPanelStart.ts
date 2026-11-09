import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { detailsWidthOf, useDetailsPaneStore, type DetailsWidthLimits } from '../../components/detailsPaneStore';
import { FILES_WIDTH } from '../diff/DiffBrowserLayout';
import { commentsPanelStartsHidden, diffWidthBesidePanel } from './inline/commentsPanel';

/** The Comments panel beside a review's Changes, as a details panel: its key in the details' store. */
export const COMMENTS_PANEL_KEY = 'reviewComments';
/** Narrower than an object's details, and giving way first as the window narrows: the diff beside it is what's read. */
export const COMMENTS_PANEL_WIDTH: DetailsWidthLimits = { initial: 340, min: 260, max: 560, restMin: 640 };

/**
 * Starts the Comments panel hidden when it has nothing to list (`commentsPanelStartsHidden`), decided once the
 * conversation is first read (`codeThreads`, null until then); leaving the review forgets it.
 */
export function useCommentsPanelStart(codeThreads: number | null, tab: RefObject<HTMLElement | null>): void {
  const decided = useRef(false);
  // This tab's own start: another review's tab, replacing it, starts before this one is cleaned up.
  const [owner] = useState(() => ({}));
  const startHidden = useDetailsPaneStore((state) => state.startHidden);
  const forgetStarted = useDetailsPaneStore((state) => state.forgetStarted);
  // Before the frame paints: the panel never shows for a moment first.
  useLayoutEffect(() => {
    if (decided.current || codeThreads === null) return;
    decided.current = true;
    const panelWidth = detailsWidthOf(useDetailsPaneStore.getState(), COMMENTS_PANEL_KEY, COMMENTS_PANEL_WIDTH);
    // The files' list at its starting width: `SplitPane` keeps no width it was dragged to, so every diff opens with it.
    const diffWidth = diffWidthBesidePanel({ tabWidth: tab.current?.clientWidth ?? 0, filesWidth: FILES_WIDTH, panelWidth });
    if (commentsPanelStartsHidden({ codeThreads, diffWidth })) startHidden(COMMENTS_PANEL_KEY, owner);
  }, [codeThreads, startHidden, tab, owner]);
  useEffect(
    () => () => {
      decided.current = false;
      forgetStarted(COMMENTS_PANEL_KEY, owner);
    },
    [forgetStarted, owner],
  );
}
