// Where each comment's pin is on the versions shown, worked out once per set of pins and versions: the node its part is
// in that version (`nodeOfSpot`), whose matrix, as drawn, places it every frame (`placedSpot`), a take's pose included.

import { Matrix4 } from 'three';
import type { ModelPin } from './modelAnnotations';
import type { ModelScene } from './modelScene';
import { viewerSpaceOf } from './modelSpaces';
import { nodeOfSpot, placedSpot, spotOfPick } from './modelSpots';
import type { ModelSpot } from '@shared/domain/reviewConversation';
import type { ModelSummary } from './modelSummary';
import type { Vector } from './orbitCamera';
import type { ParsedModel } from './parsedModel';
import type { Side } from './viewLayout';

/** A version as drawn: its file, what it holds, and its scene. */
export interface DrawnVersion {
  model: ParsedModel;
  summary: ModelSummary;
  scene: ModelScene;
}

/** A pin on a version shown: where its point is now, in the viewer's space, and the key of the node it's on there. */
export interface PinPlace {
  pin: ModelPin;
  /** Where its point is as the version is drawn now: read each frame, as a take moves the part. */
  point: () => Vector;
  /** The node its part is in this version, by its key (`ModelSummary`), to light it up; none when it names no part. */
  nodeKey: string | null;
  /** The part it names isn't in this version: it shows at its point. */
  partGone: boolean;
}

/** Each pin's place on the version it's on; none for a pin on a version not shown. */
export function pinPlacesOf(pins: readonly ModelPin[], versions: Record<Side, DrawnVersion | null>): PinPlace[] {
  return pins.flatMap((pin) => {
    const version = versions[pin.side];
    if (!version) return [];
    const node = nodeOfSpot(version.model, pin.spot);
    const nodeKey = node === null ? null : (version.summary.nodes[node]?.key ?? null);
    const object = nodeKey === null ? undefined : version.scene.objects.get(nodeKey);
    const viewerSpace = viewerSpaceOf(version.model);
    const nodeWorld = (): Matrix4 => object!.matrixWorld;
    const placeable = object ? node : null;
    return [{ pin, nodeKey, point: () => placedSpot(pin.spot, placeable, nodeWorld, viewerSpace).point, partGone: placedSpot(pin.spot, node, () => new Matrix4(), viewerSpace).partGone }];
  });
}

/**
 * The spot a pick on a version marks (`spotOfPick`): the point hit on the mesh of the node `key` names, as that node is
 * drawn now, and the camera then. None where nothing was hit.
 */
export function spotOfHit(version: DrawnVersion, hit: { key: string | null; point: Vector | null }, camera: Vector, wholePart: boolean): ModelSpot | null {
  if (!hit.point) return null;
  const index = hit.key === null ? -1 : version.summary.nodes.findIndex((node) => node.key === hit.key);
  const node = index >= 0 && version.scene.objects.has(hit.key!) ? index : null;
  const nodeWorld = (): Matrix4 => version.scene.objects.get(hit.key!)!.matrixWorld;
  return spotOfPick(version.model, { point: hit.point, node, camera }, nodeWorld, viewerSpaceOf(version.model), wholePart);
}
