import type { MergeLink } from '@shared/domain/branchExplorer';
import type { GraphLayout, Lane } from '../model/layoutGraph';
import { linkCurve } from './curves';
import { nodePoint } from './geometry';
import { laneShape } from './laneShape';
import { boundsOf } from './linkVisibility';
import { SpanIndex } from './spanIndex';

interface LayoutSpans {
  lanes: SpanIndex;
  mergeLinks: SpanIndex;
}

const spansByLayout = new WeakMap<GraphLayout, LayoutSpans>();

/** Where each lane and merge link reaches along the graph (world x), indexed once per layout. */
function spansOf(layout: GraphLayout): LayoutSpans {
  let spans = spansByLayout.get(layout);
  if (!spans) {
    const lanes = layout.lanes.map((lane) => {
      const shape = laneShape(lane);
      const base = lane.baseChangeset !== null ? nodePoint(layout, lane.baseChangeset) : null;
      // The band, and the elbow down from its base changeset on the parent's band.
      return { left: Math.min(shape.left, base?.x ?? shape.left), right: shape.right };
    });
    const links = layout.mergeLinks.map((link) => boundsOf(linkCurve(nodePoint(layout, link.sourceChangeset)!, nodePoint(layout, link.destinationChangeset)!)));
    spans = {
      lanes: new SpanIndex(lanes.map((span) => span.left), lanes.map((span) => span.right)),
      mergeLinks: new SpanIndex(links.map((span) => span.left), links.map((span) => span.right)),
    };
    spansByLayout.set(layout, spans);
  }
  return spans;
}

const found: number[] = [];

/** The lanes whose band or elbow reaches into [left, right] (world x), in drawing order. */
export function lanesAcross(layout: GraphLayout, left: number, right: number): Lane[] {
  return spansOf(layout).lanes.overlapping(left, right, found).map((index) => layout.lanes[index]!);
}

/** The merge links whose curve reaches into [left, right] (world x), in drawing order. */
export function mergeLinksAcross(layout: GraphLayout, left: number, right: number): MergeLink[] {
  return spansOf(layout).mergeLinks.overlapping(left, right, found).map((index) => layout.mergeLinks[index]!);
}
