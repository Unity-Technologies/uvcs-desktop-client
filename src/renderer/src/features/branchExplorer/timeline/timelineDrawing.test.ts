import { describe, expect, it } from 'vitest';
import { layoutGraph } from '../model/layoutGraph';
import { branchColor, type GraphPalette } from '../canvas/graphPalette';
import { NO_RULE_COLORS } from '../model/ruleColors';
import { timelineCurves } from './timelineCurvePath';
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
const curves = timelineCurves({ total: new Float64Array(500), share: new Float64Array(500), sharePresent: new Uint8Array(500) });

const inputs = (changes: Partial<TimelineDrawingInputs> = {}): TimelineDrawingInputs => ({
  layout,
  history: timelineHistory(layout),
  axis,
  palette,
  curves,
  frame: { left: 100, right: 140 },
  hover: null,
  dragging: null,
  axisLabels: [],
  labels: [],
  gaps: [],
  hits: [],
  home: null,
  homePlaces: { home: null, pending: false },
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

  it('pins no selected changeset where the house already stands', () => {
    const home = { kind: 'inRange' as const, column: layout.nodes.get(5)!.column, changeset: 5, pendingColumn: null };
    expect(timelineDrawing(inputs({ selectedChangeset: 5, home })).selectedChangesetX).toBeNull();
    expect(timelineDrawing(inputs({ selectedChangeset: 5, home: { ...home, pendingColumn: 9 } })).selectedChangesetX).not.toBeNull();
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

  it('makes the frame active (full halo, grips) while it is hovered or dragged, never while scrubbing elsewhere', () => {
    expect(timelineDrawing(inputs()).frameActive).toBe(false);
    expect(timelineDrawing(inputs({ hover: { target: { kind: 'frame' }, x: 120 } })).frameActive).toBe(true);
    expect(timelineDrawing(inputs({ hover: { target: { kind: 'frameEdge', edge: 'left' }, x: 100 } })).frameActive).toBe(true);
    expect(timelineDrawing(inputs({ dragging: { kind: 'zoom', edge: 'right' } })).frameActive).toBe(true);
    expect(timelineDrawing(inputs({ dragging: { kind: 'pan' } })).frameActive).toBe(true);
    expect(timelineDrawing(inputs({ dragging: { kind: 'scrub' } })).frameActive).toBe(false);
  });

  it('shows the edges’ grips while the frame is active and wide enough to have them', () => {
    const hovered = { hover: { target: { kind: 'frame' as const }, x: 120 } };
    expect(timelineDrawing(inputs(hovered)).grips).toBe(true);
    expect(timelineDrawing(inputs({ ...hovered, frame: { left: 100, right: 106 } })).grips).toBe(false);
    expect(timelineDrawing(inputs()).grips).toBe(false);
  });

  it('dashes the house’s ring when it stands for pending changes', () => {
    expect(timelineDrawing(inputs({ homePlaces: { home: { x: 10, y: 20 }, pending: true } }))).toMatchObject({ home: { x: 10, y: 20 }, homePending: true });
  });

  it('draws the ghost frame only while the pointer is on an empty spot', () => {
    expect(timelineDrawing(inputs({ hover: { target: { kind: 'moment' }, x: 300 } })).ghost).toEqual({ left: 280, right: 320 });
    expect(timelineDrawing(inputs({ hover: { target: { kind: 'frame' }, x: 120 } })).ghost).toBeNull();
    expect(timelineDrawing(inputs()).ghost).toBeNull();
    expect(timelineDrawing(inputs({ hover: { target: { kind: 'moment' }, x: 300 }, dragging: { kind: 'scrub' } })).ghost).toBeNull();
  });
});
