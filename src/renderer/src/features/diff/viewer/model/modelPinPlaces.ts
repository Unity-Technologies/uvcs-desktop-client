// Where each comment's pin is on the versions shown, worked out once per set of pins and versions: the node its part is
// in that version (`nodeOfSpot`), whose matrix, as drawn, places it every frame (`placedSpot`), a take's pose included;
// on a skinned mesh, the triangle it's on (`skinAnchorOfSpot`), whose corners, as the skeleton bends them, place it.

import { Box3, Matrix4, Vector3, type SkinnedMesh } from 'three';
import type { ModelPin } from './modelAnnotations';
import type { ModelScene } from './modelScene';
import { viewerSpaceOf } from './modelSpaces';
import { nodeOfSpot, placedSpot, spotOfPick } from './modelSpots';
import type { ModelSpot } from '@shared/domain/reviewConversation';
import type { ModelSummary } from './modelSummary';
import type { Vector } from './orbitCamera';
import type { ParsedModel } from './parsedModel';
import type { Side } from './viewLayout';
import { drawnAnchorPoint, restPointOfHit, skinAnchorOfSpot, type SkinAnchor } from './skinAnchors';

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
  /** The corners of the box its whole part fills as drawn now (a comment on a part); none for one on a point. */
  partCorners: () => Vector[] | null;
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
    const partCorners = (): Vector[] | null => (pin.spot.wholePart && object ? boxCorners(new Box3().setFromObject(object)) : null);
    const skin = placeable === null ? null : skinOf(version, placeable, pin.spot);
    const point = skin ? () => drawnAnchorPoint(skin.anchor, skin.mesh).toArray() as Vector : () => placedSpot(pin.spot, placeable, nodeWorld, viewerSpace).point;
    return [{ pin, nodeKey, point, partGone: placedSpot(pin.spot, node, () => new Matrix4(), viewerSpace).partGone, partCorners }];
  });
}

/** The anchor of a spot on a skinned part, and the mesh as drawn that bends it; none for a rigid part. */
function skinOf(version: DrawnVersion, node: number, spot: ModelSpot): { anchor: SkinAnchor; mesh: SkinnedMesh } | null {
  const anchor = skinAnchorOfSpot(version.model, node, spot.node?.local);
  if (!anchor) return null;
  return { anchor, mesh: drawnSkinnedMesh(version, anchor.mesh) };
}

/** A skinned mesh as the version's scene draws it (`buildModelScene` makes it a `SkinnedMesh`, typed as a mesh). */
function drawnSkinnedMesh(version: DrawnVersion, mesh: number): SkinnedMesh {
  return version.scene.meshes[mesh]!.solid as unknown as SkinnedMesh;
}

/** A pin gone to, and where it is on the version it's on: what the camera glides to show. */
export interface RevealedPin {
  pin: ModelPin;
  place: PinPlace;
  version: DrawnVersion;
}

/**
 * The pin a reveal asks for (the Comments panel, the conversation, a link), once per reveal (`revealedSeq`: the last
 * one shown), once the pair is framed (`ready`) and the pins hold it: they may arrive after the framing, or before.
 * None until then, or for a pin on a version not shown.
 */
export function revealedPin(reveal: { key: string; seq: number } | null, revealedSeq: number | null, ready: boolean, pins: readonly ModelPin[], versions: Record<Side, DrawnVersion | null>): RevealedPin | null {
  if (!reveal || reveal.seq === revealedSeq || !ready) return null;
  const pin = pins.find((candidate) => candidate.key === reveal.key);
  const version = pin && versions[pin.side];
  const [place] = pin ? pinPlacesOf([pin], versions) : [];
  return pin && version && place ? { pin, place, version } : null;
}

/**
 * The spot a pick on a version marks (`spotOfPick`): the point hit on the mesh of the node `key` names, as that node is
 * drawn now (on a skinned mesh, the same place on it with the skin at rest: `restPointOfHit`), and the camera then.
 * None where nothing was hit.
 */
export function spotOfHit(version: DrawnVersion, hit: { key: string | null; point: Vector | null }, camera: Vector, wholePart: boolean): ModelSpot | null {
  if (!hit.point) return null;
  const index = hit.key === null ? -1 : version.summary.nodes.findIndex((node) => node.key === hit.key);
  const node = index >= 0 && version.scene.objects.has(hit.key!) ? index : null;
  const nodeWorld = (): Matrix4 => version.scene.objects.get(hit.key!)!.matrixWorld;
  const atRest = node === null ? null : restPointOfHit(version.model, node, new Vector3(...hit.point), (mesh) => drawnSkinnedMesh(version, mesh));
  const pick = { point: hit.point, node, camera, ...(atRest && { restInFile: atRest.toArray() as Vector }) };
  return spotOfPick(version.model, pick, nodeWorld, viewerSpaceOf(version.model), wholePart);
}

function boxCorners(box: Box3): Vector[] | null {
  if (box.isEmpty()) return null;
  const { min, max } = box;
  return [0, 1, 2, 3, 4, 5, 6, 7].map((corner): Vector => [corner & 1 ? max.x : min.x, corner & 2 ? max.y : min.y, corner & 4 ? max.z : min.z]);
}
