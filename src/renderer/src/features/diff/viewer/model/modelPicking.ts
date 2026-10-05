// What a pick lights up and frames: a part clicked with its match on the other side, the dots for picked nodes that
// draw nothing (bones, empties), and the room framed around them.

import type { NodeRef } from './modelChanges';
import { pivotOf, type ModelScene } from './modelScene';
import type { ModelSummary } from './modelSummary';
import type { NodeMatching } from './nodeMatching';
import type { BoundsLike, Vector } from './orbitCamera';

/** A part clicked on one side, with the node it is on the other side, so both light up. */
export function clickedNode(side: 'before' | 'after', key: string, before: ModelSummary | null, after: ModelSummary | null, matching: NodeMatching | null): NodeRef {
  const own = side === 'before' ? before : after;
  const index = own?.nodes.findIndex((node) => node.key === key) ?? -1;
  const node = own?.nodes[index];
  const other = matching && index >= 0 ? (side === 'before' ? matching.afterOf[index] : matching.beforeOf[index]) : -1;
  const otherKey = other !== undefined && other >= 0 ? (side === 'before' ? after : before)?.nodes[other]?.key : undefined;
  return {
    name: node?.name ?? key,
    path: node?.path ?? key,
    kind: node?.kind ?? 'mesh',
    ...(side === 'before' ? { before: key, ...(otherKey !== undefined && { after: otherKey }) } : { after: key, ...(otherKey !== undefined && { before: otherKey }) }),
  };
}

/** Where the picked nodes that draw nothing (bones, empties) are on each side: their pivots, marked as dots. */
export function markersOf(nodes: NodeRef[], before: ModelScene | null, after: ModelScene | null): Record<'before' | 'after', Vector[]> {
  const pivots = (scene: ModelScene | null, keys: (string | undefined)[]): Vector[] =>
    keys.flatMap((key) => {
      const pivot = key === undefined || !scene || scene.meshes.some((mesh) => mesh.key === key) ? null : pivotOf(scene, key);
      return pivot ? [pivot.toArray() as Vector] : [];
    });
  return { before: pivots(before, nodes.map((node) => node.before)), after: pivots(after, nodes.map((node) => node.after)) };
}

/** A box around points with a third of the model around them, so a bone framed shows the part of the model it moves. */
export function aroundPoints(markers: Record<'before' | 'after', Vector[]>, model: BoundsLike | null): BoundsLike | null {
  const points = [...markers.before, ...markers.after];
  if (points.length === 0 || !model) return null;
  const pad = Math.max(...model.max.map((value, axis) => value - model.min[axis]!)) * 0.3;
  const min = [0, 1, 2].map((axis) => Math.min(...points.map((point) => point[axis]!)) - pad) as Vector;
  const max = [0, 1, 2].map((axis) => Math.max(...points.map((point) => point[axis]!)) + pad) as Vector;
  return { min, max };
}
