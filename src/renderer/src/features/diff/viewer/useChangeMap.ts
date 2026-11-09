import type { Virtualizer } from '@pierre/diffs';
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { ChangedLine, ChangeRegion, DiffSide } from './changeBlocks';
import { changeMarks, placesAgain, showsChangeMap, type ChangeMark, type MarksPlacedFrom } from './changeMarks';
import { mapTickMarks, type MapTick, type MapTickMark } from './mapTicks';
import { pierreChangeColors, sameChangeColors, type ChangeColors } from './pierreChangeColors';
import { pierreShadowRoot } from './pierreDom';
import { pierreLineBox } from './pierreLinePosition';

/** The change map as measured: its marks, and the sizes of the view it stands beside. */
export interface ChangeMapView {
  marks: ChangeMark[];
  /** The place's ticks (a review's comments), drawn over the marks. */
  ticks: MapTickMark[];
  /** The diff's scrolling content (`scrollHeight`), which the track stands for whole. */
  contentHeight: number;
  /** The view's height (`clientHeight`). */
  viewHeight: number;
  /** The track's height: the bar runs the view's whole height. */
  trackHeight: number;
  /** The colors the diff draws its removed and added lines in (`pierreChangeColors`), the marks' too. */
  colors: ChangeColors;
}

interface ChangeMapOptions {
  /** The diff's scrolling element. */
  containerRef: RefObject<HTMLElement | null>;
  virtualizer: Virtualizer;
  /** The diff's changes (`useChangeNavigation`'s, so they follow what's typed); none where it doesn't step through them. */
  regions: readonly ChangeRegion[];
  lineCounts: Record<DiffSide, number>;
  /** Both sides are real versions; a version shown alone marks no change, only its ticks. */
  bothSides: boolean;
  /** The spots the place marks (`DiffAnnotations.mapTicks`); none where it adds nothing. */
  ticks: readonly MapTick[];
  /** How the lines are laid out (Split or Unified, collapsed, wrapped): a new one places the marks again. */
  layoutKey: string;
}

/**
 * The change map of the diff in `containerRef` (`changeMarks`), or null while it doesn't show (`showsChangeMap`). The
 * marks and the place's ticks (`mapTickMarks`) are placed where Pierre lays their lines out (`pierreLineBox`), and placed
 * again (`placesAgain`) when the changes, the ticks, the layout
 * or the sizes change: on a resize, and as Pierre renders rows (expanding unchanged lines, wrapped lines measured),
 * batched to a frame as `PaneScrollbars` measures. Scrolling renders rows too, but leaves the sizes as they were, so
 * it places nothing again. The marks' colors are read anew each time, apart from that: a theme switch recolors the
 * diff without moving anything.
 */
export function useChangeMap({ containerRef, virtualizer, regions, lineCounts, bothSides, ticks, layoutKey }: ChangeMapOptions): ChangeMapView | null {
  const [view, setView] = useState<ChangeMapView | null>(null);
  const latest = useRef({ regions, lineCounts, bothSides, ticks, layoutKey });
  latest.current = { regions, lineCounts, bothSides, ticks, layoutKey };
  const placedFrom = useRef<MarksPlacedFrom | null>(null);

  // After every render, as `PaneScrollbars`: the diff (and its shadow root) may have only just appeared.
  useEffect(() => {
    const container = containerRef.current;
    const root = pierreShadowRoot(container);
    if (!container || !root) return;
    let frame = 0;
    const measure = (): void => {
      frame = 0;
      const { regions, lineCounts, bothSides, ticks, layoutKey } = latest.current;
      const fileContainer = container.querySelector('diffs-container');
      if (!fileContainer) return;
      const colors = pierreChangeColors(fileContainer);
      const boxOf = (line: ChangedLine) => pierreLineBox(virtualizer, fileContainer, line);
      const from: MarksPlacedFrom = {
        regions,
        bothSides,
        ticks,
        layoutKey,
        contentHeight: container.scrollHeight,
        viewHeight: container.clientHeight,
        lastChangeTop: regions.length > 0 ? boxOf(regions.at(-1)!.lines[0]!)?.top : undefined,
        lastTickTop: ticks.length > 0 ? boxOf(ticks.at(-1)!)?.top : undefined,
      };
      if (!placesAgain(placedFrom.current, from)) {
        setView((current) => (current && !sameChangeColors(current.colors, colors) ? { ...current, colors } : current));
        return;
      }
      placedFrom.current = from;
      const { contentHeight, viewHeight } = from;
      if (!showsChangeMap({ changes: regions.length, bothSides, ticks: ticks.length, contentHeight, viewHeight })) return setView(null);
      const trackHeight = viewHeight;
      const layout = { boxOf, lineCounts, contentHeight, trackHeight };
      // A version shown alone is one change, the whole text: only its ticks are marked.
      const marks = bothSides ? changeMarks(regions, layout) : [];
      const next = { marks, ticks: mapTickMarks(ticks, layout), contentHeight, viewHeight, trackHeight, colors };
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
  return a.contentHeight === b.contentHeight && a.viewHeight === b.viewHeight && sameChangeColors(a.colors, b.colors) && sameMarks(a.marks, b.marks) && sameTicks(a.ticks, b.ticks);
}

function sameTicks(a: readonly MapTickMark[], b: readonly MapTickMark[]): boolean {
  return a.length === b.length && a.every((tick, index) => {
    const other = b[index]!;
    return tick.top === other.top && tick.emphasized === other.emphasized && tick.keys.join('\n') === other.keys.join('\n');
  });
}

function sameMarks(a: readonly ChangeMark[], b: readonly ChangeMark[]): boolean {
  return a.length === b.length && a.every((mark, index) => {
    const other = b[index]!;
    return mark.top === other.top && mark.height === other.height && mark.kind === other.kind && mark.first === other.first && mark.last === other.last;
  });
}
