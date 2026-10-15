// What the camera frames: both versions together (so the pair shares a framing, as the image diff's composed frame
// does), or the nodes a picked change is about, on whichever side each is. In the viewer's space (`viewerBounds`).

import type { NodeRef } from './modelChanges';
import type { Bounds, ModelSummary } from './modelSummary';
import type { BoundsLike } from './orbitCamera';

/**
 * Whether each version there is (`present`: the diff has it) has what is waited for (`have`: its read, its scene).
 * The camera frames only once every version's scene is in the renderer: framed with one still missing, the renderer
 * laid the other out alone, full width, and the pair kept a framing made for that shape until the window was resized.
 */
export function everyVersionHas(present: { before: boolean; after: boolean }, have: { before: unknown; after: unknown }): boolean {
  return (!present.before || have.before != null) && (!present.after || have.after != null);
}

/** The union of the versions' bounds, in the viewer's space; null when neither draws anything. */
export function framedBounds(...summaries: (ModelSummary | null)[]): BoundsLike | null {
  return union(summaries.flatMap((summary) => (summary?.bounds ? [summary.bounds] : [])));
}

/** The bounds of the nodes, on each side they're on, in the viewer's space; null when none draws anything. */
export function nodesBounds(nodes: NodeRef[], before: ModelSummary | null, after: ModelSummary | null): BoundsLike | null {
  const boundsOf = (summary: ModelSummary | null, key: string | undefined): Bounds[] => {
    const bounds = key === undefined ? undefined : summary?.nodes.find((node) => node.key === key)?.bounds;
    return bounds ? [bounds] : [];
  };
  return union(nodes.flatMap((node) => [...boundsOf(before, node.before), ...boundsOf(after, node.after)]));
}

/** Unity's bounds (X mirrored) as one box in the viewer's. */
function union(boxes: Bounds[]): BoundsLike | null {
  if (boxes.length === 0) return null;
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const box of boxes) {
    const viewerMin = [-box.max[0], box.min[1], box.min[2]];
    const viewerMax = [-box.min[0], box.max[1], box.max[2]];
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis]!, viewerMin[axis]!);
      max[axis] = Math.max(max[axis]!, viewerMax[axis]!);
    }
  }
  return { min, max };
}
