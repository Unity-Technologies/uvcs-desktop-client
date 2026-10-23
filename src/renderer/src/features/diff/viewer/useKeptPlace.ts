import type { Virtualizer } from '@pierre/diffs';
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { rowAtTopOf } from './changeView';
import { useDiffPreferences } from './diffPreferencesStore';
import { keptOffset, linesLayoutOf, notedPlace, placeToRestore, type KeptPlace, type LayoutOverrides, type LinesLayout } from './keptPlace';
import { scrollToLine } from './lineScroll';

interface KeptPlaceOptions {
  /** The diff's scrolling element. */
  containerRef: RefObject<HTMLElement | null>;
  virtualizer: Virtualizer;
  /** How the lines are drawn now (`linesLayoutOf`). */
  shown: LinesLayout;
  /** What the file shown overrides of the preferences. */
  overrides: LayoutOverrides;
}

/**
 * Keeps the user's place as the diff's lines are laid out anew (`keptPlace`): the line at the top is read as the
 * preference changes, before React draws again (the store tells its listeners at once), and put back where its row
 * stood once Pierre laid the lines out (its `FileDiff`, a child, applies its options in a layout effect, before this
 * one).
 */
export function useKeptPlace({ containerRef, virtualizer, shown, overrides }: KeptPlaceOptions): void {
  const kept = useRef<KeptPlace | null>(null);
  const latestOverrides = useRef(overrides);
  latestOverrides.current = overrides;

  useEffect(
    () =>
      useDiffPreferences.subscribe((after, before) => {
        const container = containerRef.current;
        const fileOverrides = latestOverrides.current;
        kept.current = notedPlace(kept.current, linesLayoutOf(before, fileOverrides), linesLayoutOf(after, fileOverrides), () => (container ? rowAtTopOf(container) : null));
      }),
    [containerRef],
  );

  useLayoutEffect(() => {
    const place = placeToRestore(kept.current, shown);
    kept.current = null;
    const container = containerRef.current;
    if (!place || !container) return;
    return scrollToLine(container, place.line, virtualizer, (_view, height) => keptOffset(place, height));
    // The layout as drawn, field by field: a new object for the same layout lays nothing out anew.
  }, [shown.layout, shown.collapseUnchanged, shown.wrapLines, containerRef, virtualizer]);
}
