import type { GraphLayout } from '../model/layoutGraph';
import { branchColor, type GraphPalette } from '../canvas/graphPalette';
import type { ActivityCurve } from './activityCurve';
import type { TimelineDrawing } from './drawTimeline';
import { stripXOfColumn, type TimelineAxis } from './timelineAxis';
import type { PlacedAxisLabel } from './timelineCalendar';
import type { TimelineFrame } from './timelineFrame';
import type { TimelineHistory } from './timelineHistory';
import { branchLifetime, type HitTick, type HomeMark, type LabelTick, type TimelineGap } from './timelineMarks';
import { ghostFrame, type Point, type TimelineTarget } from './timelineTargets';

/** What one frame of the Timeline draws from: what was measured once (the curve, the marks) and what changes (the frame, the hover, the selection). */
export interface TimelineDrawingInputs {
  layout: GraphLayout;
  history: TimelineHistory;
  axis: TimelineAxis;
  palette: GraphPalette;
  curve: ActivityCurve;
  frame: TimelineFrame;
  hover: { target: TimelineTarget; x: number } | null;
  axisLabels: readonly PlacedAxisLabel[];
  labels: readonly LabelTick[];
  gaps: readonly TimelineGap[];
  hits: readonly HitTick[];
  home: HomeMark;
  homePlaces: { home: Point | null; pending: Point | null };
  selectedChangeset: number | null;
  selectedBranch: string | null;
}

/**
 * Everything one frame draws, placed on the strip: the hover's ghost frame over an empty spot, /main's newest
 * changeset, the selected changeset's column (a "+N" node's for one folded in it) and the selected branch's lifetime in
 * its hue; none for what isn't in the graph.
 */
export function timelineDrawing(inputs: TimelineDrawingInputs): TimelineDrawing {
  const { layout, history, axis, palette, frame, hover, home, selectedChangeset, selectedBranch } = inputs;
  const selectedColumn = selectedChangeset === null ? undefined : layout.nodes.get(selectedChangeset)?.column;
  const lifetime = branchLifetime(layout, axis, selectedBranch);
  return {
    width: axis.width,
    palette,
    curve: inputs.curve,
    frame,
    ghost: hover ? ghostFrame(hover.target, frame, hover.x) : null,
    axisLabels: inputs.axisLabels,
    labels: inputs.labels,
    gaps: inputs.gaps,
    hits: inputs.hits,
    ...inputs.homePlaces,
    homeOlderThanRange: home?.kind === 'olderThanRange',
    newestMainX: history.newestMainColumn === null ? null : stripXOfColumn(axis, history.newestMainColumn),
    selectedChangesetX: selectedColumn === undefined ? null : stripXOfColumn(axis, selectedColumn),
    selectedBranch: lifetime && selectedBranch !== null ? { ...lifetime, color: branchColor(palette, selectedBranch) } : null,
  };
}
