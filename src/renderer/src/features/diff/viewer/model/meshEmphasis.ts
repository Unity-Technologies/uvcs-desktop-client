// How a mesh stands out while parts are picked (a click, a row of "What changed"): lit up, faded towards the backdrop,
// or neither; and whether a lit one is outlined by its wireframe too.

import type { BufferGeometry } from 'three';

/** How a mesh stands out while some are picked: lit up, faded towards the backdrop, or neither. */
export type Emphasis = 'plain' | 'lit' | 'faded';

/** A mesh lit up when it or a node above it is picked; faded when others are picked and it isn't. */
export function emphasisOf(meshKey: string, picked: ReadonlySet<string>, anyPicked: boolean): Emphasis {
  const lit = picked.has(meshKey) || [...picked].some((key) => meshKey.startsWith(`${key}/`));
  return lit ? 'lit' : anyPicked ? 'faded' : 'plain';
}

/**
 * A mesh this dense isn't outlined when lit up in the shaded mode: its wires, closer than pixels, only tint it the
 * highlight's color, which its glow already does, and three builds a wireframe's lines on the main thread the first
 * time it draws one (140 ms and 200 MB, CPU and GPU, for 3 million triangles). The Wireframe modes draw it whole.
 */
export const LIT_OUTLINE_MAX_TRIANGLES = 250_000;

export function outlinesWhenLit(geometry: Pick<BufferGeometry, 'index' | 'attributes'>): boolean {
  const corners = geometry.index?.count ?? geometry.attributes.position?.count ?? 0;
  return corners / 3 <= LIT_OUTLINE_MAX_TRIANGLES;
}
