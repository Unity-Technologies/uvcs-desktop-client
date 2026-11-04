import type { GraphLayout } from '../model/layoutGraph';
import type { Size, Viewport } from '../canvas/viewport';
import { columnAtStrip, type TimelineAxis } from './timelineAxis';
import { viewportCenteredAt, viewportFrame, viewportPannedBy, viewportShowingRow, viewportWithEdgeAt } from './timelineFrame';
import type { TimelinePress } from './timelineTargets';

/** One step of a drag on the strip: the pointer moved `dx` since the last step and is now at `x`. */
export interface DragStep {
  dx: number;
  x: number;
}

/**
 * The view one step of a drag leaves: dragging the frame pans by as much, dragging an edge zooms with the other edge
 * fixed, a press anywhere else scrubs (the frame centered under the pointer).
 */
export function viewportForDrag(press: TimelinePress, current: Viewport, axis: TimelineAxis, screen: Size, { dx, x }: DragStep): Viewport {
  switch (press.kind) {
    case 'pan':
      return viewportPannedBy(current, axis, dx);
    case 'zoom':
      return viewportWithEdgeAt(current, axis, screen, press.edge, x);
    case 'scrub':
      return viewportCenteredAt(current, axis, screen, x);
  }
}

/**
 * Where the view glides once a drag ends: to bring the row of the changeset the frame landed on into view; null when it
 * already is, and nothing moves.
 */
export function viewportAfterDrag(layout: GraphLayout, current: Viewport, axis: TimelineAxis, screen: Size): Viewport | null {
  const frame = viewportFrame(axis, current, screen);
  const shown = viewportShowingRow(layout, current, screen, columnAtStrip(axis, (frame.left + frame.right) / 2));
  return shown === current ? null : shown;
}
