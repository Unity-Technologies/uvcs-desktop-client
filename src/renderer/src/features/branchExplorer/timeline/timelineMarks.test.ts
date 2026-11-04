import { describe, expect, it } from 'vitest';
import type { GraphLabel } from '@shared/domain/branchExplorer';
import { layoutGraph } from '../model/layoutGraph';
import { stripXOfColumn, type TimelineAxis } from './timelineAxis';
import { datedHistory } from './timelineFixtures';
import { timelineHistory } from './timelineHistory';
import { branchLifetime, hitTicks, homeMark, labelTicks, LABEL_MERGE_DISTANCE, searchHitColumns, timelineGaps } from './timelineMarks';

const label = (name: string, changeset: number): GraphLabel => ({ name, changeset, owner: 'jane', date: '', comment: '' });

/** One world px per strip px: column c at x = 56 + 64c. */
const wide = (columnCount: number): TimelineAxis => ({ worldWidth: 10_000, width: 10_000, columnCount });

describe('labelTicks', () => {
  const dates = Array.from({ length: 10 }, (_, day) => `2026-09-${String(day + 1).padStart(2, '0')}T10:00:00Z`);
  const data = datedHistory(dates);
  data.labels = [label('v1', 0), label('v2', 1), label('v3', 2), label('v4', 6)];
  const history = timelineHistory(layoutGraph(data));

  it('draws one tick per label where they are apart', () => {
    expect(labelTicks(history, wide(10)).map((tick) => tick.labels.map(({ label }) => label.name))).toEqual([['v1'], ['v2'], ['v3'], ['v4']]);
  });

  it('merges ticks closer than 5 px into one, at their middle, oldest first', () => {
    // 64 world px per column at 1/16: 4 strip px apart.
    const narrow: TimelineAxis = { worldWidth: 16_000, width: 1_000, columnCount: 10 };
    const ticks = labelTicks(history, narrow);
    expect(ticks.map((tick) => tick.labels.map(({ label }) => label.name))).toEqual([['v1', 'v2'], ['v3'], ['v4']]);
    expect(ticks[0]!.x).toBeCloseTo((stripXOfColumn(narrow, 0) + stripXOfColumn(narrow, 1)) / 2);
  });

  it('never chains a run of close ticks into one: a tick spans less than 5 px', () => {
    const daily = datedHistory(dates);
    daily.labels = dates.map((_, index) => label(`b${index}`, index));
    const ticks = labelTicks(timelineHistory(layoutGraph(daily)), { worldWidth: 25_600, width: 1_000, columnCount: 10 });
    expect(ticks.length).toBeGreaterThan(1);
    for (const tick of ticks) expect(tick.labels.length).toBeLessThanOrEqual(Math.ceil(LABEL_MERGE_DISTANCE / 2.5));
  });
});

describe('timelineGaps', () => {
  it('marks more than 3 days without changesets between two columns', () => {
    const history = timelineHistory(layoutGraph(datedHistory(['2026-12-20T10:00:00Z', '2026-12-23T09:00:00Z', '2027-01-03T10:00:00Z', '2027-01-04T10:00:00Z'])));
    const gaps = timelineGaps(history, wide(4));
    expect(gaps).toEqual([
      { x: (stripXOfColumn(wide(4), 1) + stripXOfColumn(wide(4), 2)) / 2, column: 2, from: Date.parse('2026-12-23T09:00:00Z'), to: Date.parse('2027-01-03T10:00:00Z'), days: 11 },
    ]);
  });

  it('keeps only the longest of the gaps closer than a few px, so a sparse history isn’t a row of marks', () => {
    const history = timelineHistory(layoutGraph(datedHistory(['2026-01-01T10:00:00Z', '2026-01-10T10:00:00Z', '2026-02-10T10:00:00Z', '2026-02-20T10:00:00Z'])));
    const crowded: TimelineAxis = { worldWidth: 64_000, width: 1_000, columnCount: 4 };
    expect(timelineGaps(history, crowded).map(({ days }) => days)).toEqual([31]);
    expect(timelineGaps(history, wide(4)).map(({ days }) => days)).toEqual([9, 31, 10]);
  });

  it('marks none where a "+N" node holds changesets made in between', () => {
    const data = datedHistory([
      '2026-09-01T10:00:00Z',
      { date: '2026-09-01T11:00:00Z', branch: '/main/task' },
      { date: '2026-09-03T11:00:00Z', branch: '/main/task' },
      { date: '2026-09-06T11:00:00Z', branch: '/main/task' },
      { date: '2026-09-10T11:00:00Z', branch: '/main/task' },
      '2026-09-12T10:00:00Z',
    ]);
    // Unfolded, nothing is made between Sep 6 and Sep 10; folded, Sep 6 is in the node at Sep 3, before the gap.
    const whole = timelineHistory(layoutGraph(data));
    expect(timelineGaps(whole, wide(whole.columnTimes.length)).map(({ column }) => column)).toEqual([4]);
    const folded = timelineHistory(layoutGraph(data, { keep: new Set() }));
    expect(timelineGaps(folded, wide(folded.columnTimes.length))).toEqual([]);
  });
});

describe('homeMark', () => {
  const data = datedHistory(['2026-09-01T10:00:00Z', '2026-09-02T10:00:00Z', { date: '2026-09-03T10:00:00Z', branch: '/main/task' }]);

  it('is the loaded changeset’s column, with the pending changes’ past every changeset', () => {
    const layout = layoutGraph(data, undefined, { branch: '/main/task', parent: 2, mergeLinks: [] });
    expect(homeMark(layout, timelineHistory(layout), 2)).toEqual({ kind: 'inRange', column: 2, changeset: 2, pendingColumn: 3 });
    const clean = layoutGraph(data);
    expect(homeMark(clean, timelineHistory(clean), 1)).toEqual({ kind: 'inRange', column: 1, changeset: 1, pendingColumn: null });
  });

  it('is older than the range when the loaded changeset comes before everything loaded', () => {
    const later = datedHistory(['2026-09-01T10:00:00Z']);
    later.changesets[0]!.id = 500;
    const layout = layoutGraph(later);
    expect(homeMark(layout, timelineHistory(layout), 120)).toEqual({ kind: 'olderThanRange', changeset: 120 });
  });

  it('is nothing on a changeset the filters hide, or without a workspace', () => {
    const layout = layoutGraph(data);
    expect(homeMark(layout, timelineHistory(layout), 1_000)).toBeNull();
    expect(homeMark(layout, timelineHistory(layout), null)).toBeNull();
  });
});

describe('search marks', () => {
  const data = datedHistory(['2026-09-01T10:00:00Z', '2026-09-02T10:00:00Z', { date: '2026-09-03T10:00:00Z', branch: '/main/task' }]);
  data.labels = [label('v1', 1)];
  const layout = layoutGraph(data);

  it('find the column of a changeset, a label’s changeset and a branch’s first changeset', () => {
    expect(searchHitColumns(layout, [{ kind: 'changeset', id: 0 }, { kind: 'label', name: 'v1', changeset: 1 }, { kind: 'branch', name: '/main/task' }, { kind: 'changeset', id: 99 }])).toEqual([0, 1, 2]);
  });

  it('draw one tick per pixel, counting the hits in it', () => {
    const axis: TimelineAxis = { worldWidth: 6_400, width: 100, columnCount: 3 };
    expect(hitTicks([0, 0, 2], axis)).toEqual([
      { x: Math.floor(stripXOfColumn(axis, 0)) + 0.5, count: 2 },
      { x: Math.floor(stripXOfColumn(axis, 2)) + 0.5, count: 1 },
    ]);
  });
});

describe('branchLifetime', () => {
  it('spans a branch from its first column to its last', () => {
    const layout = layoutGraph(datedHistory(['2026-09-01T10:00:00Z', { date: '2026-09-02T10:00:00Z', branch: '/main/task' }, { date: '2026-09-03T10:00:00Z', branch: '/main/task' }]));
    const lane = layout.lanesByBranch.get('/main/task')!;
    expect(branchLifetime(layout, wide(3), '/main/task')).toEqual({ left: stripXOfColumn(wide(3), lane.startColumn), right: stripXOfColumn(wide(3), lane.endColumn) });
    expect(branchLifetime(layout, wide(3), null)).toBeNull();
    expect(branchLifetime(layout, wide(3), '/main/gone')).toBeNull();
  });
});
