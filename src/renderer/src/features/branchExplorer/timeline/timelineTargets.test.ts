import { describe, expect, it } from 'vitest';
import type { ActivityCurve } from './activityCurve';
import { columnAtStrip, stripXOfColumn, type TimelineAxis } from './timelineAxis';
import { BASELINE, HIT_TICK_HEIGHT, HIT_TICK_TOP, PLOT_HEIGHT, PLOT_TOP } from './timelineGeometry';
import type { LabelTick, TimelineGap } from './timelineMarks';
import { clickedColumn, curveTopAt, gapsClearOfHome, ghostFrame, homeSpots, HOUSE_RADIUS, PINNED_HOUSE_X, timelineCursor, timelinePress, timelineTargetAt, type TimelineSpots } from './timelineTargets';

const tick = (x: number, columns: number[]): LabelTick => ({
  x,
  labels: columns.map((column) => ({ label: { name: `v${column}`, changeset: column, owner: '', date: '', comment: '' }, column, time: column })),
});
const gap: TimelineGap = { x: 300, column: 31, from: 0, to: 1, days: 5 };
const spots: TimelineSpots = {
  frame: { left: 100, right: 200 },
  labels: [tick(150, [15]), tick(400, [40, 41])],
  gaps: [gap],
  hits: [{ x: 120.5, count: 3 }],
  home: { x: 500, y: 30 },
};
const middle = (PLOT_TOP + BASELINE) / 2;

describe('timelineTargetAt', () => {
  it('grabs the frame’s edges first, then what is in it, then the frame itself', () => {
    expect(timelineTargetAt(spots, 102, middle)).toEqual({ kind: 'frameEdge', edge: 'left' });
    expect(timelineTargetAt(spots, 197, middle)).toEqual({ kind: 'frameEdge', edge: 'right' });
    expect(timelineTargetAt(spots, 150, BASELINE + 3)).toEqual({ kind: 'labels', tick: spots.labels[0] });
    expect(timelineTargetAt(spots, 121, 2)).toEqual({ kind: 'hits', tick: spots.hits[0] });
    expect(timelineTargetAt(spots, 150, middle)).toEqual({ kind: 'frame' });
  });

  it('gives a narrow frame no edges to grab', () => {
    const narrow = { ...spots, frame: { left: 100, right: 108 } };
    expect(timelineTargetAt(narrow, 101, middle)).toEqual({ kind: 'frame' });
  });

  it('keeps a frame thinner than a line grabbable a few px around it', () => {
    const line = { ...spots, frame: { left: 100, right: 101 } };
    expect(timelineTargetAt(line, 105, middle)).toEqual({ kind: 'frame' });
    expect(timelineTargetAt(line, 107, middle)).toEqual({ kind: 'moment' });
  });

  it('finds the house, a gap, else the moment', () => {
    expect(timelineTargetAt(spots, 505, 34)).toEqual({ kind: 'home' });
    expect(timelineTargetAt(spots, 302, middle)).toEqual({ kind: 'gap', gap });
    expect(timelineTargetAt(spots, 700, middle)).toEqual({ kind: 'moment' });
    // A label tick is only under the baseline.
    expect(timelineTargetAt(spots, 400, PLOT_TOP)).toEqual({ kind: 'moment' });
  });
});

describe('a press', () => {
  it('zooms at an edge, pans on the frame, scrubs anywhere else', () => {
    expect(timelinePress({ kind: 'frameEdge', edge: 'right' })).toEqual({ kind: 'zoom', edge: 'right' });
    expect(timelinePress({ kind: 'frame' })).toEqual({ kind: 'pan' });
    expect(timelinePress({ kind: 'moment' })).toEqual({ kind: 'scrub' });
    expect(timelinePress({ kind: 'home' })).toEqual({ kind: 'scrub' });
  });

  it('shows as a resize at the edges, a grab on the frame and a pointer elsewhere', () => {
    expect(timelineCursor({ kind: 'frameEdge', edge: 'left' })).toBe('ew-resize');
    expect(timelineCursor({ kind: 'frame' })).toBe('grab');
    expect(timelineCursor({ kind: 'gap', gap })).toBe('pointer');
    expect(timelineCursor(null)).toBe('pointer');
  });
});

describe('clickedColumn', () => {
  const axis: TimelineAxis = { worldWidth: 10_000, width: 1_000, inset: 0, columnCount: 150 };
  const home = { kind: 'inRange' as const, column: 50, changeset: 7, pendingColumn: 150 };

  it('goes to a tick’s newest label, where history resumes after a gap, and home: its pending changes when it has some', () => {
    expect(clickedColumn({ kind: 'labels', tick: spots.labels[1]! }, 0, axis, home)).toBe(41);
    expect(clickedColumn({ kind: 'gap', gap }, 0, axis, home)).toBe(31);
    expect(clickedColumn({ kind: 'home' }, 0, axis, home)).toBe(150);
    expect(clickedColumn({ kind: 'home' }, 0, axis, { ...home, pendingColumn: null })).toBe(50);
  });

  it('goes to the oldest column for a workspace older than the range', () => {
    expect(clickedColumn({ kind: 'home' }, 0, axis, { kind: 'olderThanRange', changeset: 3 })).toBe(0);
  });

  it('goes to the column under the pointer anywhere else', () => {
    const x = stripXOfColumn(axis, 77);
    expect(clickedColumn({ kind: 'moment' }, x, axis, home)).toBe(77);
    expect(clickedColumn({ kind: 'frame' }, x, axis, home)).toBe(columnAtStrip(axis, x));
  });
});

describe('homeSpots', () => {
  const curve: ActivityCurve = { total: Float64Array.from({ length: 1_000 }, () => 0.5), share: new Float64Array(1_000), sharePresent: new Uint8Array(1_000) };
  const axis: TimelineAxis = { worldWidth: 10_000, width: 1_000, inset: 0, columnCount: 150 };

  it('stands the house on the curve at the workspace’s column', () => {
    const { home, pending } = homeSpots({ kind: 'inRange', column: 50, changeset: 7, pendingColumn: null }, axis, curve);
    expect(home!.x).toBeCloseTo(stripXOfColumn(axis, 50));
    expect(home!.y).toBeLessThan(curveTopAt(curve, home!.x));
    expect(curveTopAt(curve, home!.x)).toBe(BASELINE - 0.5 * PLOT_HEIGHT);
    expect(pending).toBe(false);
  });

  it('moves the house to the pending changes past every changeset, as the graph moves its badge, to draw its ring dashed', () => {
    const { home, pending } = homeSpots({ kind: 'inRange', column: 50, changeset: 7, pendingColumn: 150 }, axis, curve);
    expect(home!.x).toBeCloseTo(stripXOfColumn(axis, 150));
    expect(pending).toBe(true);
  });

  it('keeps the house under the top edge’s search ticks where the curve is at its tallest, sitting into it', () => {
    const tall: ActivityCurve = { ...curve, total: new Float64Array(1_000).fill(1) };
    for (const pendingColumn of [null, 51]) {
      const { home } = homeSpots({ kind: 'inRange', column: 50, changeset: 7, pendingColumn }, axis, tall);
      expect(home!.y - HOUSE_RADIUS).toBeGreaterThan(HIT_TICK_TOP + HIT_TICK_HEIGHT);
    }
  });

  it('pins the house at the left edge for a workspace older than the range, and draws none without one', () => {
    expect(homeSpots({ kind: 'olderThanRange', changeset: 3 }, axis, curve)).toEqual({ home: { x: PINNED_HOUSE_X, y: expect.any(Number) }, pending: false });
    expect(homeSpots(null, axis, curve)).toEqual({ home: null, pending: false });
  });
});

describe('ghostFrame', () => {
  it('shows where a click would take the frame over an empty spot only', () => {
    expect(ghostFrame({ kind: 'moment' }, { left: 100, right: 120 }, 400)).toEqual({ left: 390, right: 410 });
    expect(ghostFrame({ kind: 'home' }, { left: 100, right: 120 }, 400)).toBeNull();
    expect(ghostFrame({ kind: 'frame' }, { left: 100, right: 120 }, 110)).toBeNull();
    expect(ghostFrame(null, { left: 100, right: 120 }, 400)).toBeNull();
  });
});

describe('gapsClearOfHome', () => {
  it('leaves out the break marks under the house', () => {
    const near: TimelineGap = { ...gap, x: 505 };
    expect(gapsClearOfHome([gap, near], { x: 500, y: 30 })).toEqual([gap]);
    expect(gapsClearOfHome([gap, near], null)).toEqual([gap, near]);
  });
});
