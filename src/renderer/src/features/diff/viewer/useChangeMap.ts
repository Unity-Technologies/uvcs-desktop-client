import type { Virtualizer } from '@pierre/diffs';
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { ChangedLine, ChangeRegion, DiffSide } from './changeBlocks';
import { changeMarks, placesAgain, showsChangeMap, type ChangeMark, type MarksPlacedFrom } from './changeMarks';
import { pierreShadowRoot } from './pierreDom';
import { pierreLineBox } from './pierreLinePosition';

/** The change map as measured: its marks, and the sizes of the view it stands beside. */
export interface ChangeMapView {
  marks: ChangeMark[];
  /** The diff's scrolling content (`scrollHeight`), which the strip stands for whole. */
  contentHeight: number;
  /** The view's height, and the strip's: it runs beside the scrollbar's whole track. */
  viewHeight: number;
  /** How wide the view's vertical scrollbar is: the strip stands just left of it. */
  scrollbarWidth: number;
}

interface ChangeMapOptions {
  /** The diff's scrolling element. */
  containerRef: RefObject<HTMLElement | null>;
  virtualizer: Virtualizer;
  /** The diff's changes (`useChangeNavigation`'s, so they follow what's typed); none where it doesn't step through them. */
  regions: readonly ChangeRegion[];
  lineCounts: Record<DiffSide, number>;
  /** Both sides are real versions; a version shown alone has no map. */
  bothSides: boolean;
  /** How the lines are laid out (Split or Unified, collapsed, wrapped): a new one places the marks again. */
  layoutKey: string;
}

/**
 * The change map of the diff in `containerRef` (`changeMarks`), or null while it doesn't show (`showsChangeMap`). The
 * marks are placed where Pierre lays the changes out (`pierreLineBox`), and placed again (`placesAgain`) when the changes, the layout
 * or the sizes change: on a resize, and as Pierre renders rows (expanding unchanged lines, wrapped lines measured),
 * batched to a frame as `PaneScrollbars` measures. Scrolling renders rows too, but leaves the sizes as they were, so
 * it places nothing again.
 */
export function useChangeMap({ containerRef, virtualizer, regions, lineCounts, bothSides, layoutKey }: ChangeMapOptions): ChangeMapView | null {
  const [view, setView] = useState<ChangeMapView | null>(null);
  const latest = useRef({ regions, lineCounts, bothSides, layoutKey });
  latest.current = { regions, lineCounts, bothSides, layoutKey };
  const placedFrom = useRef<MarksPlacedFrom | null>(null);

  // After every render, as `PaneScrollbars`: the diff (and its shadow root) may have only just appeared.
  useEffect(() => {
    const container = containerRef.current;
    const root = pierreShadowRoot(container);
    if (!container || !root) return;
    let frame = 0;
    const measure = (): void => {
      frame = 0;
      const { regions, lineCounts, bothSides, layoutKey } = latest.current;
      const fileContainer = container.querySelector('diffs-container');
      const boxOf = (line: ChangedLine) => (fileContainer ? pierreLineBox(virtualizer, fileContainer, line) : undefined);
      const from: MarksPlacedFrom = {
        regions,
        bothSides,
        layoutKey,
        contentHeight: container.scrollHeight,
        viewHeight: container.clientHeight,
        lastChangeTop: regions.length > 0 ? boxOf(regions.at(-1)!.lines[0]!)?.top : undefined,
      };
      if (!placesAgain(placedFrom.current, from)) return;
      placedFrom.current = from;
      const { contentHeight, viewHeight } = from;
      if (!showsChangeMap({ changes: regions.length, bothSides, contentHeight, viewHeight })) return setView(null);
      const marks = changeMarks(regions, { boxOf, lineCounts, contentHeight, stripHeight: viewHeight });
      const scrollbarWidth = container.offsetWidth - container.clientWidth - 2 * container.clientLeft;
      const next = { marks, contentHeight, viewHeight, scrollbarWidth };
      setView((current) => (current && sameView(current, next) ? current : next));
    };
    const schedule = (): void => {
      frame ||= requestAnimationFrame(measure);
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(container);
    const mutations = new MutationObserver(schedule);
    mutations.observe(root, { childList: true, subtree: true });
    measure();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
    };
  });

  return view;
}

function sameView(a: ChangeMapView, b: ChangeMapView): boolean {
  return a.contentHeight === b.contentHeight && a.viewHeight === b.viewHeight && a.scrollbarWidth === b.scrollbarWidth && sameMarks(a.marks, b.marks);
}

function sameMarks(a: readonly ChangeMark[], b: readonly ChangeMark[]): boolean {
  return a.length === b.length && a.every((mark, index) => {
    const other = b[index]!;
    return mark.top === other.top && mark.height === other.height && mark.kind === other.kind && mark.first === other.first && mark.last === other.last;
  });
}
