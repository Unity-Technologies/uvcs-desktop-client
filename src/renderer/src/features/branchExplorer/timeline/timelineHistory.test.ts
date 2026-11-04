import { describe, expect, it } from 'vitest';
import { countCalls } from '@shared/testing/countCalls';
import { layoutGraph } from '../model/layoutGraph';
import { countBetween, sortedSearch } from './sortedSearch';
import { datedHistory } from './timelineFixtures';
import { changesetsBetween, changesetsInColumns, mainChangesetsAfter, timelineHistory, timelineShare } from './timelineHistory';

const at = (iso: string) => Date.parse(iso);

describe('sortedSearch', () => {
  const values = Float64Array.from([1, 3, 3, 3, 7]);

  it('finds where a value starts and ends in ascending values', () => {
    expect(sortedSearch.lowerBound(values, 3)).toBe(1);
    expect(sortedSearch.upperBound(values, 3)).toBe(4);
    expect(sortedSearch.lowerBound(values, 8)).toBe(5);
    expect(sortedSearch.upperBound(values, 0)).toBe(0);
  });

  it('counts the values in a closed range, none when it is empty or reversed', () => {
    expect(countBetween(values, 3, 7)).toBe(4);
    expect(countBetween(values, 4, 6)).toBe(0);
    expect(countBetween(values, 7, 3)).toBe(0);
    expect(countBetween(new Float64Array(0), 0, 10)).toBe(0);
  });
});

describe('timelineHistory', () => {
  const data = datedHistory([
    { date: '2026-09-01T10:00:00Z' },
    { date: '2026-09-02T10:00:00Z', branch: '/main/task', owner: 'ana' },
    { date: '2026-09-03T10:00:00Z', branch: '/main/task', owner: 'ana' },
    { date: '2026-09-04T10:00:00Z', branch: '/main/task' },
    { date: '2026-09-05T10:00:00Z', branch: '/main/task', owner: 'ana' },
    { date: '2026-09-06T10:00:00Z' },
  ]);
  data.mergeLinks = [{ type: 'merge', sourceChangeset: 4, destinationChangeset: 5 }];
  data.labels = [
    { name: 'v2', changeset: 5, owner: 'jane', date: '', comment: '' },
    { name: 'v1', changeset: 0, owner: 'jane', date: '', comment: '' },
  ];

  it('reads each column’s time and every changeset’s, sorted', () => {
    const history = timelineHistory(layoutGraph(data));
    expect([...history.columnTimes]).toEqual([1, 2, 3, 4, 5, 6].map((day) => at(`2026-09-0${day}T10:00:00Z`)));
    expect(history.start).toBe(at('2026-09-01T10:00:00Z'));
    expect(history.end).toBe(at('2026-09-06T10:00:00Z'));
  });

  it("finds /main's merges, its newest changeset and how far it moved on since a changeset", () => {
    const history = timelineHistory(layoutGraph(data));
    expect([...history.mainMergeTimes]).toEqual([at('2026-09-06T10:00:00Z')]);
    expect(history.newestMainColumn).toBe(5);
    expect(mainChangesetsAfter(history, 0)).toBe(1);
    expect(mainChangesetsAfter(history, 5)).toBe(0);
  });

  it('orders the labels by their changeset’s time, with its column', () => {
    const history = timelineHistory(layoutGraph(data));
    expect(history.labels.map(({ label, column }) => [label.name, column])).toEqual([
      ['v1', 0],
      ['v2', 5],
    ]);
  });

  it('counts what a "+N" node holds as its own changesets, at its column', () => {
    const layout = layoutGraph(data, { keep: new Set() });
    const history = timelineHistory(layout);
    // 2 and 3 fold into one node on /main/task, between its first changeset (1) and its last (4).
    expect(layout.columnCount).toBe(5);
    expect(history.times.length).toBe(6);
    expect(changesetsInColumns(history, 0, 4)).toBe(6);
    expect(changesetsInColumns(history, 2, 2)).toBe(2);
    expect(changesetsInColumns(history, 3, 1)).toBe(0);
  });

  it('parses each date once per layout, and hands back the same history after', () => {
    const layout = layoutGraph(data);
    const { result, calls } = countCalls(Date, 'parse', () => timelineHistory(layout));
    expect(calls).toBe(data.changesets.length);
    expect(timelineHistory(layout)).toBe(result);
  });

  it("takes the share's changesets, a \"+N\" node's included, and marks their columns", () => {
    const layout = layoutGraph(data, { keep: new Set() });
    const history = timelineHistory(layout);
    const owners = new Set(['ana']);
    const share = timelineShare(history, owners);
    expect([...share.times]).toEqual([at('2026-09-02T10:00:00Z'), at('2026-09-03T10:00:00Z'), at('2026-09-05T10:00:00Z')]);
    expect([...share.columns]).toEqual([0, 1, 1, 1, 0]);
    expect(timelineShare(history, owners)).toBe(share);
  });

  it('counts the changesets made in a span, its end excluded', () => {
    const history = timelineHistory(layoutGraph(data));
    expect(changesetsBetween(history.times, at('2026-09-02T10:00:00Z'), at('2026-09-04T10:00:00Z'))).toBe(2);
  });
});
