import type { ActivityCurve } from './activityCurve';
import { columnAtStrip, stripXOfColumn, type TimelineAxis } from './timelineAxis';
import { frameCenteredAt, frameShape, type TimelineFrame } from './timelineFrame';
import { BASELINE, HIT_TICK_HEIGHT, MERGED_LABEL_TICK_HEIGHT, PLOT_HEIGHT, PLOT_TOP } from './timelineGeometry';
import type { HitTick, HomeMark, LabelTick, TimelineGap } from './timelineMarks';

export interface Point {
  x: number;
  y: number;
}

/** What the pointer is on in the Timeline. */
export type TimelineTarget =
  | { kind: 'frameEdge'; edge: 'left' | 'right' }
  | { kind: 'frame' }
  | { kind: 'home' }
  | { kind: 'pending' }
  | { kind: 'labels'; tick: LabelTick }
  | { kind: 'gap'; gap: TimelineGap }
  | { kind: 'hits'; tick: HitTick }
  /** Anywhere else: the moment under the pointer. */
  | { kind: 'moment' };

/** Where the things the pointer can land on are drawn, in strip px. */
export interface TimelineSpots {
  frame: TimelineFrame;
  labels: readonly LabelTick[];
  gaps: readonly TimelineGap[];
  hits: readonly HitTick[];
  /** The house's middle. */
  home: Point | null;
  /** The pending changes' ring's middle. */
  pending: Point | null;
}

/** The house stands this far above the curve, and sits this far in from the left edge when the workspace is older than everything loaded. */
const HOUSE_LIFT = 8;
export const PINNED_HOUSE_X = 16;

/** The top of the curve at a point of the strip. */
export function curveTopAt(curve: ActivityCurve, x: number): number {
  const pixel = Math.min(curve.total.length - 1, Math.max(0, Math.floor(x)));
  return BASELINE - (curve.total[pixel] ?? 0) * PLOT_HEIGHT;
}

/** The pending changes' ring's radius, and the house's disc's: room the house keeps from the ring and the top edge. */
export const PENDING_RING_RADIUS = 5;
export const HOUSE_RADIUS = 7.5;
/** The house's highest middle: its disc stays under the search hits' ticks along the top edge. */
const HOUSE_TOP = HIT_TICK_HEIGHT + 2 + HOUSE_RADIUS;

/**
 * Where the house and the pending changes' ring go: the house on the curve at the workspace's column (or pinned at the
 * left edge), the ring on the baseline at the right end; a house close above the ring stands clear of it. Where the
 * curve stands taller than room above it, the house sits into the curve rather than over the top edge.
 */
export function homeSpots(mark: HomeMark, axis: TimelineAxis, curve: ActivityCurve): { home: Point | null; pending: Point | null } {
  if (mark === null) return { home: null, pending: null };
  if (mark.kind === 'olderThanRange') return { home: { x: PINNED_HOUSE_X, y: BASELINE - HOUSE_LIFT }, pending: null };
  const x = stripXOfColumn(axis, mark.column);
  const onCurve = Math.max(HOUSE_TOP, curveTopAt(curve, x) - HOUSE_LIFT);
  if (mark.pendingColumn === null) return { home: { x, y: onCurve }, pending: null };
  const pending = { x: stripXOfColumn(axis, mark.pendingColumn), y: BASELINE - PENDING_RING_RADIUS };
  const clearOfRing = pending.y - PENDING_RING_RADIUS - HOUSE_RADIUS - 1;
  const close = Math.abs(pending.x - x) < (PENDING_RING_RADIUS + HOUSE_RADIUS) * 2;
  return { home: { x, y: close ? Math.max(HOUSE_TOP, Math.min(onCurve, clearOfRing)) : onCurve }, pending };
}

/** The gaps whose break mark the house leaves room for: none drawn under it. */
export function gapsClearOfHome(gaps: readonly TimelineGap[], home: Point | null): readonly TimelineGap[] {
  return home ? gaps.filter((gap) => Math.abs(gap.x - home.x) > HOUSE_RADIUS + 4) : gaps;
}

/** How near (px) the pointer must be to grab or hover each thing. */
const REACH = { edge: 4, line: 5, label: 3, hit: 2, home: 8, gap: 4 };

/**
 * What the pointer is on, the most precise first: the frame's edges (only where they have handles), a label tick under
 * the baseline, a search hit along the top, the house, the pending changes, a gap's break mark, the frame, else the
 * moment under it.
 */
export function timelineTargetAt(spots: TimelineSpots, x: number, y: number): TimelineTarget {
  const { frame } = spots;
  const shape = frameShape(frame);
  if (shape === 'boxWithEdges') {
    if (Math.abs(x - frame.left) <= REACH.edge) return { kind: 'frameEdge', edge: 'left' };
    if (Math.abs(x - frame.right) <= REACH.edge) return { kind: 'frameEdge', edge: 'right' };
  }
  if (y >= BASELINE - 2 && y <= BASELINE + MERGED_LABEL_TICK_HEIGHT + 4) {
    const tick = nearest(spots.labels, x, REACH.label);
    if (tick) return { kind: 'labels', tick };
  }
  if (y <= HIT_TICK_HEIGHT + 3) {
    const tick = nearest(spots.hits, x, REACH.hit);
    if (tick) return { kind: 'hits', tick };
  }
  if (spots.home && Math.hypot(x - spots.home.x, y - spots.home.y) <= REACH.home) return { kind: 'home' };
  if (spots.pending && Math.hypot(x - spots.pending.x, y - spots.pending.y) <= REACH.home) return { kind: 'pending' };
  if (y >= PLOT_TOP && y <= BASELINE) {
    const gap = nearest(spots.gaps, x, REACH.gap);
    if (gap) return { kind: 'gap', gap };
  }
  const middle = (frame.left + frame.right) / 2;
  const onFrame = shape === 'line' ? Math.abs(x - middle) <= REACH.line : x >= frame.left && x <= frame.right;
  return onFrame ? { kind: 'frame' } : { kind: 'moment' };
}

function nearest<T extends { x: number }>(items: readonly T[], x: number, reach: number): T | null {
  let best: T | null = null;
  for (const item of items) if (Math.abs(item.x - x) <= reach && (!best || Math.abs(item.x - x) < Math.abs(best.x - x))) best = item;
  return best;
}

/** What a press does: drag an edge to zoom, drag the frame to pan, or scrub (press and drag anywhere else). */
export type TimelinePress = { kind: 'zoom'; edge: 'left' | 'right' } | { kind: 'pan' } | { kind: 'scrub' };

export function timelinePress(target: TimelineTarget): TimelinePress {
  if (target.kind === 'frameEdge') return { kind: 'zoom', edge: target.edge };
  return target.kind === 'frame' ? { kind: 'pan' } : { kind: 'scrub' };
}

/** The pointer over the strip: resizing at the edges, grabbing the frame, pointing elsewhere. */
export function timelineCursor(target: TimelineTarget | null): 'ew-resize' | 'grab' | 'pointer' {
  if (target?.kind === 'frameEdge') return 'ew-resize';
  return target?.kind === 'frame' ? 'grab' : 'pointer';
}

/**
 * Where a click takes the view: a label tick to its newest label, a gap to where history resumes, the house and
 * the pending changes to theirs, anything else to the column under the pointer.
 */
export function clickedColumn(target: TimelineTarget, x: number, axis: TimelineAxis, mark: HomeMark): number {
  switch (target.kind) {
    case 'labels':
      return target.tick.labels.at(-1)!.column;
    case 'gap':
      return target.gap.column;
    case 'home':
      return mark?.kind === 'inRange' ? mark.column : 0;
    case 'pending':
      return mark?.kind === 'inRange' && mark.pendingColumn !== null ? mark.pendingColumn : columnAtStrip(axis, x);
    default:
      return columnAtStrip(axis, x);
  }
}

/** The dashed frame showing where a click would take the view: only over an empty spot, where nothing else answers. */
export function ghostFrame(target: TimelineTarget | null, frame: TimelineFrame, x: number): TimelineFrame | null {
  return target?.kind === 'moment' ? frameCenteredAt(frame, x) : null;
}
