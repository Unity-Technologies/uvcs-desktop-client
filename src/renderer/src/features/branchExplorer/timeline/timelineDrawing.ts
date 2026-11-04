import type { GraphLayout } from '../model/layoutGraph';
import { branchColor, type GraphPalette } from '../canvas/graphPalette';
import type { TimelineDrawing } from './drawTimeline';
import { stripXOfColumn, type TimelineAxis } from './timelineAxis';
import type { PlacedAxisLabel } from './timelineCalendar';
import type { TimelineCurves } from './timelineCurvePath';
import { frameShape, type TimelineFrame } from './timelineFrame';
import type { TimelineHistory } from './timelineHistory';
import { branchLifetime, type HitTick, type HomeMark, type LabelTick, type TimelineGap } from './timelineMarks';
import { ghostFrame, type HomeSpot, type TimelinePress, type TimelineTarget } from './timelineTargets';

/** What one frame of the Timeline draws from: what was measured once (the curve, the marks) and what changes (the frame, the hover, the selection). */
export interface TimelineDrawingInputs {
  layout: GraphLayout;
  history: TimelineHistory;
  axis: TimelineAxis;
  palette: GraphPalette;
  curves: TimelineCurves;
  frame: TimelineFrame;
  hover: { target: TimelineTarget; x: number } | null;
  /** What a press on the strip is doing, while the pointer is down. */
  dragging: TimelinePress | null;
  axisLabels: readonly PlacedAxisLabel[];
  labels: readonly LabelTick[];
  gaps: readonly TimelineGap[];
  hits: readonly HitTick[];
  home: HomeMark;
  homePlaces: HomeSpot;
  selectedChangeset: number | null;
  selectedBranch: string | null;
}

/**
 * Everything one frame draws, placed on the strip: the frame active (its full halo) while it is hovered or dragged,
 * with its edges' grips once it is wide enough to have them, the hover's ghost frame over an empty spot, /main's newest
 * changeset, the selected changeset's column (a "+N" node's for one folded in it; none where the house stands) and the selected branch's lifetime in
 * its hue; none for what isn't in the graph.
 */
export function timelineDrawing(inputs: TimelineDrawingInputs): TimelineDrawing {
  const { layout, history, axis, palette, frame, hover, dragging, home, homePlaces, selectedChangeset, selectedBranch } = inputs;
  const selectedColumn = selectedChangeset === null ? undefined : layout.nodes.get(selectedChangeset)?.column;
  // The house already marks the workspace's changeset: no pin through it.
  const frameActive = dragging ? dragging.kind !== 'scrub' : hover?.target.kind === 'frame' || hover?.target.kind === 'frameEdge';
  const pinned = selectedColumn !== undefined && !(home?.kind === 'inRange' && home.pendingColumn === null && home.column === selectedColumn);
  const lifetime = branchLifetime(layout, axis, selectedBranch);
  return {
    width: axis.width,
    palette,
    curves: inputs.curves,
    frame,
    frameActive,
    grips: frameActive && frameShape(frame) === 'boxWithEdges',
    ghost: hover && !dragging ? ghostFrame(hover.target, frame, hover.x) : null,
    axisLabels: inputs.axisLabels,
    labels: inputs.labels,
    gaps: inputs.gaps,
    hits: inputs.hits,
    home: homePlaces.home,
    homePending: homePlaces.pending,
    homeOlderThanRange: home?.kind === 'olderThanRange',
    newestMainX: history.newestMainColumn === null ? null : stripXOfColumn(axis, history.newestMainColumn),
    selectedChangesetX: pinned ? stripXOfColumn(axis, selectedColumn) : null,
    selectedBranch: lifetime && selectedBranch !== null ? { ...lifetime, color: branchColor(palette, selectedBranch) } : null,
  };
}
