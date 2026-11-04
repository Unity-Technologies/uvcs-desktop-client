import type { GraphLayout } from '../model/layoutGraph';
import type { SearchHit } from '../model/searchGraph';
import { countBetween } from './sortedSearch';
import { stripXOfColumn, type TimelineAxis } from './timelineAxis';
import type { TimedLabel, TimelineHistory } from './timelineHistory';

/** Label ticks closer than this (px) are one tick, a little taller: labels come about one a day in a busy repository. */
export const LABEL_MERGE_DISTANCE = 5;

/** One hairline tick under the baseline for one label or several close together. */
export interface LabelTick {
  x: number;
  /** Oldest first. */
  labels: readonly TimedLabel[];
}

/**
 * The labels' ticks: one per label, those within `LABEL_MERGE_DISTANCE` of a tick's first label joining it, drawn at
 * the middle of the labels it holds. Every label takes one shape: rare ones standing up as flags was dropped, since two
 * shapes need explaining.
 */
export function labelTicks(history: TimelineHistory, axis: TimelineAxis): LabelTick[] {
  const placed = history.labels.map((label) => ({ label, x: stripXOfColumn(axis, label.column) })).sort((a, b) => a.x - b.x);
  const ticks: LabelTick[] = [];
  let group: typeof placed = [];
  const close = (): void => {
    if (group.length === 0) return;
    ticks.push({ x: (group[0]!.x + group.at(-1)!.x) / 2, labels: group.map(({ label }) => label).sort((a, b) => a.time - b.time) });
    group = [];
  };
  for (const each of placed) {
    if (group.length > 0 && each.x - group[0]!.x >= LABEL_MERGE_DISTANCE) close();
    group.push(each);
  }
  close();
  return ticks;
}

/** More than this long without a changeset is a gap, which this axis gives no width: a break mark tells it. */
export const GAP_MIN_DAYS = 3;
const DAY = 86_400_000;

/** A stretch without changesets, between two columns. */
export interface TimelineGap {
  x: number;
  /** The first column after it. */
  column: number;
  /** The last changeset before it and the first after it. */
  from: number;
  to: number;
  days: number;
}

/** Break marks closer than this (px) would read as a smudge: of those, only the longest gap keeps its mark. */
export const GAP_MARK_SPACING = 24;

/**
 * Where more than `GAP_MIN_DAYS` pass between two columns with no changeset in between (a "+N" node's may be), the
 * longest of those closer than `GAP_MARK_SPACING` alone: a sparse history would otherwise be a row of marks.
 */
export function timelineGaps(history: TimelineHistory, axis: TimelineAxis): TimelineGap[] {
  const gaps: TimelineGap[] = [];
  const { columnTimes, times } = history;
  for (let column = 1; column < columnTimes.length; column++) {
    const from = columnTimes[column - 1]!;
    const to = columnTimes[column]!;
    if (to - from <= GAP_MIN_DAYS * DAY || countBetween(times, from + 1, to - 1) > 0) continue;
    const gap = { x: (stripXOfColumn(axis, column - 1) + stripXOfColumn(axis, column)) / 2, column, from, to, days: Math.floor((to - from) / DAY) };
    const last = gaps.at(-1);
    if (last && gap.x - last.x < GAP_MARK_SPACING) {
      if (gap.days > last.days) gaps[gaps.length - 1] = gap;
      continue;
    }
    gaps.push(gap);
  }
  return gaps;
}

/**
 * Where the workspace is on the strip: its loaded changeset's column (the house stands on the curve there), with the
 * pending changes' column when it has some; or older than everything loaded (the house pinned at the left edge);
 * or not in the graph at all (on a branch filtered out), with no mark.
 */
export type HomeMark =
  | { kind: 'inRange'; column: number; changeset: number; pendingColumn: number | null }
  | { kind: 'olderThanRange'; changeset: number }
  | null;

export function homeMark(layout: GraphLayout, history: TimelineHistory, homeChangeset: number | null): HomeMark {
  if (homeChangeset === null) return null;
  const node = layout.nodes.get(homeChangeset);
  if (node) return { kind: 'inRange', column: node.column, changeset: homeChangeset, pendingColumn: layout.pending?.column ?? null };
  return layout.columnCount > 0 && homeChangeset < history.firstId ? { kind: 'olderThanRange', changeset: homeChangeset } : null;
}

/** The columns the search found something in: a changeset's, a label's changeset's, a branch's first. */
export function searchHitColumns(layout: GraphLayout, hits: readonly SearchHit[]): number[] {
  return hits.flatMap((hit) => {
    if (hit.kind === 'branch') {
      const lane = layout.lanesByBranch.get(hit.name);
      return lane ? [lane.firstOwnColumn ?? lane.startColumn] : [];
    }
    const node = layout.nodes.get(hit.kind === 'label' ? hit.changeset : hit.id);
    return node ? [node.column] : [];
  });
}

/** The search hits' ticks along the top edge: one per pixel however many land on it, so hundreds read as a density. */
export interface HitTick {
  x: number;
  count: number;
}

export function hitTicks(columns: readonly number[], axis: TimelineAxis): HitTick[] {
  const byPixel = new Map<number, number>();
  for (const column of columns) {
    const pixel = Math.floor(stripXOfColumn(axis, column));
    byPixel.set(pixel, (byPixel.get(pixel) ?? 0) + 1);
  }
  return [...byPixel].sort(([a], [b]) => a - b).map(([pixel, count]) => ({ x: pixel + 0.5, count }));
}

/** A selected branch's lifetime on the strip, from its first column to its last. */
export function branchLifetime(layout: GraphLayout, axis: TimelineAxis, branch: string | null): { left: number; right: number } | null {
  const lane = branch === null ? undefined : layout.lanesByBranch.get(branch);
  return lane ? { left: stripXOfColumn(axis, lane.startColumn), right: stripXOfColumn(axis, lane.endColumn) } : null;
}
