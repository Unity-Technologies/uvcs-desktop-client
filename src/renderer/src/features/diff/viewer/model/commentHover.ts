// While commenting on a model, the pointer shows what a click will mark: a point on the part under it, named beside
// the cursor, or with Shift held, the whole part, lit up. The viewer (`useCommentHover`) only picks and
// draws what this decides.

import type { ModelNode } from './parsedModel';
import { nodeNamesOf } from './modelSpots';
import type { Side } from './viewLayout';

/** The part under the pointer while commenting: its mesh's node on the version comments go on, and its name. */
export interface HoveredPart {
  side: Side;
  key: string;
  name: string;
}

/** A node lit up on a version. */
export interface LitNode {
  side: Side;
  key: string;
}

/** What a pick under the pointer found: the version's side, and the node key of the mesh hit (none on empty space). */
export interface HoverHit {
  side: Side;
  key: string | null;
}

/** A version as hovering names its parts: its nodes as the file has them, and their keys as the summary has them. */
export interface NamedVersion {
  model: { nodes: readonly Pick<ModelNode, 'name' | 'fileName' | 'parent'>[] };
  summary: { nodes: readonly { key: string }[] };
}

/**
 * The part a pointer shows while commenting: the mesh under it on the version comments are written on (`pick` with
 * `only`), by the name a comment's card gives it (`modelPartName`: the last of its names from the root). None over
 * empty space, over a mesh the file names no part for, or while Diffs by look compares, where a part lit would compare
 * as a change (as `litCommentPart`).
 */
export function hoveredPartOf(hit: HoverHit | null, version: NamedVersion | null, comparesLooks: boolean): HoveredPart | null {
  if (comparesLooks || !hit?.key || !version) return null;
  const name = partNameOf(version, hit.key);
  return name === null ? null : { side: hit.side, key: hit.key, name };
}

/** The name of a version's part by its node key, as a comment on it names it; none for a key the version hasn't. */
export function partNameOf(version: NamedVersion, key: string): string | null {
  const index = version.summary.nodes.findIndex((node) => node.key === key);
  return index < 0 ? null : (nodeNamesOf(version.model.nodes, index).at(-1) ?? null);
}

/** Whether two hovers light the same part: the pointer moving over one part doesn't light it again. */
export function sameHoveredPart(a: HoveredPart | null, b: HoveredPart | null): boolean {
  return a?.side === b?.side && a?.key === b?.key;
}

/**
 * The part lit while commenting: the one under the pointer while Shift aims a click at all of it (`wholePart`); none
 * while a click would mark a point there, so the light never promises the whole part. With nothing under the pointer,
 * a comment's own part (`litCommentPart`: its card open, its bubble pointed at).
 */
export function litWhileCommenting(hovered: LitNode | null, wholePart: boolean, comment: LitNode | null): LitNode | null {
  if (hovered) return wholePart ? hovered : null;
  return comment;
}

/**
 * Whether the ring lies on the surface where a click would mark a point (`setCommentAim`): while a part is under the
 * pointer and Shift doesn't aim at all of it. Never under Diffs by look, where `hoveredPartOf` finds no part: drawn
 * into the version compared, the ring would compare as a change.
 */
export function aimShownWhileCommenting(hovered: HoveredPart | null, wholePart: boolean): boolean {
  return hovered !== null && !wholePart;
}

/** The words beside the cursor: what a click marks there, a point on the part or all of it, and how to switch. */
export function hoverLabelOf(part: HoveredPart, wholePart: boolean): { name: string; hint: string } {
  return wholePart ? { name: `Whole ${part.name}`, hint: 'Click to comment on all of it' } : { name: `Point on ${part.name}`, hint: 'Shift for the whole part' };
}

/** The words of the stage's comment button: what a click and a Shift-click mark, or how to stop. */
export function commentButtonLabel(active: boolean): string {
  return active ? 'Stop commenting' : 'Comment: click for a point, Shift-click for the whole part';
}

/**
 * Whether the pointer picks what's under it: not while a button is held (a drag turns the model) nor over a stage
 * control (`isOnStageControl`: a pin, a card, a button), which shows its own tooltip.
 */
export function hoverPicks(event: Pick<PointerEvent, 'buttons'>, onStageControl: boolean): boolean {
  return event.buttons === 0 && !onStageControl;
}

/** Where a pick was made: the pointer on the stage, and how far the model had moved then (`ModelRenderer.moves`). */
export interface PickedAt {
  x: number;
  y: number;
  moves: number;
}

/**
 * Whether to pick again: the pointer moved a pixel or more, or the model moved under it (a turn's coast, a glide, a
 * take, the camera flying). A frame that only redrew (the part lit up) changes neither: picking reads the GPU.
 */
export function pickAgain(last: PickedAt | null, now: PickedAt): boolean {
  if (!last || last.moves !== now.moves) return true;
  return Math.abs(now.x - last.x) >= 1 || Math.abs(now.y - last.y) >= 1;
}

/** How far the label sits from the cursor's hot spot, right and down: clear of the comment cursor drawn there. */
export const HOVER_LABEL_OFFSET = { x: 18, y: 20 };
/** The least room kept between the label and the stage's edges. */
const EDGE = 6;

/**
 * Where the label goes in the stage, in CSS pixels from its top left: below and right of the cursor, flipped to its
 * left near the right edge and above it near the bottom, and kept inside the stage.
 */
export function hoverLabelPlacement(
  pointer: { x: number; y: number },
  label: { width: number; height: number },
  stage: { width: number; height: number },
): { left: number; top: number } {
  const right = pointer.x + HOVER_LABEL_OFFSET.x;
  const below = pointer.y + HOVER_LABEL_OFFSET.y;
  const left = right + label.width > stage.width - EDGE ? pointer.x - HOVER_LABEL_OFFSET.x / 2 - label.width : right;
  const top = below + label.height > stage.height - EDGE ? pointer.y - HOVER_LABEL_OFFSET.y / 2 - label.height : below;
  return { left: clamp(left, EDGE, stage.width - EDGE - label.width), top: clamp(top, EDGE, stage.height - EDGE - label.height) };
}

/** Within `min` and `max`; at `min` when there's no room between them (a stage narrower than the label). */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
