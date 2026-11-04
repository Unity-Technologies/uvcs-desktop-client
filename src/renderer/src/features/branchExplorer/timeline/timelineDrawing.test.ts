import { describe, expect, it } from 'vitest';
import { layoutGraph } from '../model/layoutGraph';
import { branchColor, type GraphPalette } from '../canvas/graphPalette';
import { NO_RULE_COLORS } from '../model/ruleColors';
import type { ActivityCurve } from './activityCurve';
import { stripXOfColumn, timelineAxis } from './timelineAxis';
import { timelineDrawing, type TimelineDrawingInputs } from './timelineDrawing';
import { datedHistory } from './timelineFixtures';
import { timelineHistory } from './timelineHistory';

const palette = { isDark: false, accent: 'accent', accentText: 'accent text', branchHues: true, ruleColors: NO_RULE_COLORS } as GraphPalette;
// /main 0, /main/task 1 2 3 4 (2 and 3 fold into one node), /main 5.
const data = datedHistory([
  '2026-09-01T10:00:00Z',
  { date: '2026-09-02T10:00:00Z', branch: '/main/task' },
  { date: '2026-09-03T10:00:00Z', branch: '/main/task' },
  { date: '2026-09-04T10:00:00Z', branch: '/main/task' },
  { date: '2026-09-05T10:00:00Z', branch: '/main/task' },
  '2026-09-06T10:00:00Z',
]);
const layout = layoutGraph(data, { keep: new Set() });
const axis = timelineAxis(layout, 500);
const curve: ActivityCurve = { total: new Float64Array(500), share: new Float64Array(500), sharePresent: new Uint8Array(500) };

const inputs = (changes: Partial<TimelineDrawingInputs> = {}): TimelineDrawingInputs => ({
  layout,
  history: timelineHistory(layout),
  axis,
  palette,
  curve,
  frame: { left: 100, right: 140 },
  hover: null,
  axisLabels: [],
  labels: [],
  gaps: [],
  hits: [],
  home: null,
  homePlaces: { home: null, pending: null },
  selectedChangeset: null,
  selectedBranch: null,
  ...changes,
});

describe('timelineDrawing', () => {
  it("pins the selected changeset at its column, a \"+N\" node's for one folded in it, and none for one not in the graph", () => {
    expect(timelineDrawing(inputs({ selectedChangeset: 5 })).selectedChangesetX).toBe(stripXOfColumn(axis, layout.nodes.get(5)!.column));
    expect(timelineDrawing(inputs({ selectedChangeset: 3 })).selectedChangesetX).toBe(stripXOfColumn(axis, layout.nodes.get(2)!.column));
    expect(timelineDrawing(inputs({ selectedChangeset: 99 })).selectedChangesetX).toBeNull();
    expect(timelineDrawing(inputs()).selectedChangesetX).toBeNull();
  });

  it("spans the selected branch's lifetime in its hue, only while a branch in the graph is selected", () => {
    const lane = layout.lanesByBranch.get('/main/task')!;
    expect(timelineDrawing(inputs({ selectedBranch: '/main/task' })).selectedBranch).toEqual({
      left: stripXOfColumn(axis, lane.startColumn),
      right: stripXOfColumn(axis, lane.endColumn),
      color: branchColor(palette, '/main/task'),
    });
    expect(timelineDrawing(inputs({ selectedBranch: '/main/gone' })).selectedBranch).toBeNull();
    expect(timelineDrawing(inputs()).selectedBranch).toBeNull();
  });

  it("marks /main's newest changeset", () => {
    expect(timelineDrawing(inputs()).newestMainX).toBe(stripXOfColumn(axis, layout.nodes.get(5)!.column));
  });

  it('pins the house at the left for a workspace older than the range', () => {
    expect(timelineDrawing(inputs({ home: { kind: 'olderThanRange', changeset: 1 } })).homeOlderThanRange).toBe(true);
    expect(timelineDrawing(inputs({ home: { kind: 'inRange', column: 0, changeset: 0, pendingColumn: null } })).homeOlderThanRange).toBe(false);
  });

  it('draws the ghost frame only while the pointer is on an empty spot', () => {
    expect(timelineDrawing(inputs({ hover: { target: { kind: 'moment' }, x: 300 } })).ghost).toEqual({ left: 280, right: 320 });
    expect(timelineDrawing(inputs({ hover: { target: { kind: 'frame' }, x: 120 } })).ghost).toBeNull();
    expect(timelineDrawing(inputs()).ghost).toBeNull();
  });
});
