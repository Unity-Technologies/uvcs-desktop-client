import { describe, expect, it } from 'vitest';
import { countCalls } from '@shared/testing/countCalls';
import { layoutGraph } from '../model/layoutGraph';
import { sortedSearch } from './sortedSearch';
import { stripXOfColumn, timelineAxis } from './timelineAxis';
import type { TimelineCalendar } from './timelineCalendar';
import { namedLabels, timelineCard, type TimelineCardContext } from './timelineCard';
import { datedHistory, datesEvery } from './timelineFixtures';
import { timelineHistory, timelineShare } from './timelineHistory';
import { homeMark, labelTicks } from './timelineMarks';

const utc: TimelineCalendar = { locale: 'en-US', offsetMinutes: () => 0 };

/** Sep 3 (a busy day, 2 by "me", a task merged to /main twice) between quieter days: about two months, counted by day. */
function busyHistory() {
  const data = datedHistory([
    '2026-08-01T10:00:00Z',
    { date: '2026-09-03T09:00:00Z', owner: 'me' },
    { date: '2026-09-03T10:00:00Z', branch: '/main/task' },
    { date: '2026-09-03T11:00:00Z' },
    { date: '2026-09-03T12:00:00Z', branch: '/main/task', owner: 'me' },
    { date: '2026-09-03T13:00:00Z' },
    '2026-09-30T10:00:00Z',
  ]);
  data.mergeLinks = [
    { type: 'merge', sourceChangeset: 2, destinationChangeset: 3 },
    { type: 'merge', sourceChangeset: 4, destinationChangeset: 5 },
    // Into a task: not to /main.
    { type: 'merge', sourceChangeset: 1, destinationChangeset: 4 },
  ];
  data.labels = ['a', 'b', 'c', 'd', 'e'].map((name, index) => ({ name, changeset: index + 1, owner: '', date: '', comment: '' }));
  return data;
}

function contextFor(data = busyHistory(), homeChangeset: number | null = 1, owners: ReadonlySet<string> = new Set(['me'])): TimelineCardContext {
  const layout = layoutGraph(data);
  const history = timelineHistory(layout);
  const axis = timelineAxis(layout, 1_000);
  return {
    history,
    share: timelineShare(history, owners),
    shareIsMine: true,
    axis,
    calendar: utc,
    frame: { left: stripXOfColumn(axis, 1) - 1, right: stripXOfColumn(axis, 3) + 1 },
    zoom: 0.25,
    home: homeMark(layout, history, homeChangeset),
    pendingChangeCount: 4,
  };
}

describe('timelineCard', () => {
  it('tells the day under the pointer: what was made, the user’s share, what reached /main and its labels', () => {
    const context = contextFor();
    expect(timelineCard({ kind: 'moment' }, stripXOfColumn(context.axis, 2), context)).toEqual({
      title: 'Thursday, September 3, 2026',
      lines: ['5 changesets · 2 yours · 2 merged to /main', 'e, d, c and 2 more'],
    });
  });

  it('leaves out what is none, and names the people picked when the share isn’t the user’s', () => {
    const context = { ...contextFor(), shareIsMine: false };
    expect(timelineCard({ kind: 'moment' }, stripXOfColumn(context.axis, 0), context)).toEqual({ title: 'Saturday, August 1, 2026', lines: ['1 changeset'] });
    expect(timelineCard({ kind: 'moment' }, stripXOfColumn(context.axis, 1), context).lines[0]).toBe('5 changesets · 2 by the people picked · 2 merged to /main');
  });

  it('tells the frame’s dates, the zoom, what is on screen and how to move it', () => {
    const context = contextFor();
    expect(timelineCard({ kind: 'frame' }, 0, context)).toEqual({
      title: 'Sep 3',
      lines: ['Zoom 25%', 'On screen: 3 changesets', 'Drag to move · drag an edge to zoom'],
    });
    const narrow = { ...context, frame: { left: 10, right: 12 } };
    expect(timelineCard({ kind: 'frameEdge', edge: 'left' }, 0, narrow).lines.at(-1)).toBe('Drag to move · zoom out to widen it');
  });

  it('says where the workspace is and how far /main moved on since', () => {
    expect(timelineCard({ kind: 'home' }, 0, contextFor()).lines).toEqual(['On changeset 1', '/main moved on 3 changesets since']);
    expect(timelineCard({ kind: 'home' }, 0, contextFor(busyHistory(), 6)).lines).toEqual(['On changeset 6', "/main hasn't moved on since"]);
  });

  it('says a workspace older than the range is out of it', () => {
    const data = busyHistory();
    for (const changeset of data.changesets) changeset.id += 100;
    for (const changeset of data.changesets) changeset.parent = changeset.parent < 0 ? -1 : changeset.parent + 100;
    data.mergeLinks = [];
    data.labels = [];
    data.branches.forEach((branch) => (branch.headChangeset += 100));
    expect(timelineCard({ kind: 'home' }, 0, contextFor(data, 20))).toEqual({
      title: 'Your workspace',
      lines: ['On changeset 20, older than the history shown', '/main moved on 5+ changesets since'],
    });
  });

  it('counts the pending changes, names a gap’s days and counts the search matches', () => {
    const context = contextFor();
    expect(timelineCard({ kind: 'pending' }, 0, context)).toEqual({ title: 'Pending changes', lines: ['4 changes not checked in yet'] });
    expect(timelineCard({ kind: 'gap', gap: { x: 0, column: 1, from: Date.parse('2026-12-23T10:00:00Z'), to: Date.parse('2027-01-03T10:00:00Z'), days: 11 } }, 0, context)).toEqual({
      title: 'No changesets for 11 days',
      lines: ['Dec 23 – Jan 3'],
    });
    expect(timelineCard({ kind: 'hits', tick: { x: 0, count: 1 } }, 0, context).title).toBe('1 search match');
  });

  it('names a tick’s label, or how many it holds, the newest first', () => {
    const context = contextFor();
    const ticks = labelTicks(context.history, { ...context.axis, width: 100_000 });
    expect(timelineCard({ kind: 'labels', tick: ticks[0]! }, 0, context)).toEqual({ title: 'a', lines: ['Sep 3'] });
    const merged = labelTicks(context.history, { ...context.axis, width: 1 })[0]!;
    expect(timelineCard({ kind: 'labels', tick: merged }, 0, context)).toEqual({ title: '5 labels', lines: ['e, d, c and 2 more', 'Sep 3'] });
  });

  it('counts with a few searches, never reading the history again, at scale', () => {
    const context = contextFor(datedHistory(datesEvery('2025-01-01T00:00:00Z', 12_000, 44)), 5_000);
    const searches = countCalls(sortedSearch, 'lowerBound', () => timelineCard({ kind: 'moment' }, 500, context));
    // The changesets, the share and the merges in the bucket, then where its labels start and end.
    expect(searches.calls).toBe(5);
    const parses = countCalls(Date, 'parse', () => {
      for (let x = 0; x < 1_000; x += 50) timelineCard({ kind: 'moment' }, x, context);
      timelineCard({ kind: 'frame' }, 0, context);
      timelineCard({ kind: 'home' }, 0, context);
    });
    expect(parses.calls).toBe(0);
  });
});

describe('namedLabels', () => {
  it('names up to three, then how many more', () => {
    expect(namedLabels(['a'])).toBe('a');
    expect(namedLabels(['a', 'b', 'c'])).toBe('a, b, c');
    expect(namedLabels(['a', 'b', 'c', 'd'])).toBe('a, b, c and 1 more');
  });
});
