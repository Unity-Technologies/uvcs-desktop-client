// While commenting on a model, the part under the pointer lights up and its name shows beside the cursor, so a click
// is aimed at what it will mark, and Shift-click at the whole part. The viewer (`useCommentHover`) only picks and
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
 * The part lit while commenting: the one under the pointer, which a click would mark, else a comment's own part
 * (`litCommentPart`: its card open, its bubble pointed at). One at a time, so the light always says what a click takes.
 */
export function litWhileCommenting(hovered: LitNode | null, comment: LitNode | null): LitNode | null {
  return hovered ?? comment;
}

/** The words beside the cursor: the part's name, and how to comment on all of it. */
export function hoverLabelOf(part: HoveredPart): { name: string; hint: string } {
  return { name: part.name, hint: 'Shift-click for the whole part' };
}

/** The words of the stage's comment button: what a click and a Shift-click mark, or how to stop. */
export function commentButtonLabel(active: boolean): string {
  return active ? 'Stop commenting' : 'Comment: click for a point, Shift-click for the whole part';
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
