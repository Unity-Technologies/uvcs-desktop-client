import type { GraphLabel, MergeLink } from '@shared/domain/branchExplorer';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import type { PendingMergeLink } from '@shared/domain/pendingChanges';
import type { GraphLayout, Lane, NodeLayout } from '../model/layoutGraph';
import { actionsKey, type ActionsSubject } from './actionsButton';
import type { DrawnTargets, GraphScene } from './drawContext';
import type { DrawnBox } from './drawnBoxes';
import { distanceToCurve, linkCurve, type Point } from './curves';
import { BAND_HEIGHT, COLLAPSED_NODE_HALF_WIDTH, COLUMN_WIDTH, columnX, GRAPH_PADDING, NODE_RADIUS, nodePoint, pendingPoint, ROW_HEIGHT, rowY } from './geometry';
import { estimatedLabelWidth, LABEL_HEIGHT, labelChips } from './labelPlacement';
import { laneShape } from './laneShape';
import { mergeLinksAcross } from './spansInView';

/** Something the pointer can be on. */
export type GraphTarget =
  | { kind: 'changeset'; id: number }
  /** A "+N" node standing for changesets collapsed by "Only relevant changesets". */
  | { kind: 'collapsed'; node: NodeLayout }
  /** A label chip; `more` are the labels of its changeset that didn't fit, counted on it. */
  | { kind: 'label'; label: GraphLabel; more: readonly GraphLabel[] }
  | { kind: 'branch'; lane: Lane }
  | { kind: 'mergeLink'; link: MergeLink }
  /** The workspace's pending changes, drawn as the changeset they will become. */
  | { kind: 'pending' }
  /** A merge in progress, into the pending changes. */
  | { kind: 'pendingMergeLink'; link: PendingMergeLink }
  /** The code review chip in a branch's header card. */
  | { kind: 'codeReview'; review: CodeReviewSummary }
  /** The "More actions" button of a branch or a changeset (`actionsButton.ts`): a click opens its menu. */
  | { kind: 'actions'; of: ActionsSubject };

/** What gets a card by the pointer: everything but branches and the "More actions" buttons, which get a tooltip. */
export type PointerCardTarget = Exclude<GraphTarget, { kind: 'branch' } | { kind: 'actions' }>;

/** A "More actions" button's tooltip, as an icon button's names it in the lists. */
export const ACTIONS_TOOLTIP = 'More actions';

/**
 * The hover card for what the pointer is on. A changeset's card completes its comment over its caption, whether the
 * pointer is on the node or on the caption: one card, so moving between them never closes it (a changeset whose
 * caption isn't drawn gets its card by the pointer). A branch gets no card: its two-line header already says it all,
 * and a card there would cover the changesets the pointer is heading to. Only a header's line that doesn't show all
 * of it (a name cut to fit, a comment cut or with more lines) gets a plain tooltip with the whole of it, like any
 * clipped label in the app, while the pointer is on that line. A "More actions" button gets that plain tooltip too, with
 * its name. Anything else gets its card by the pointer.
 * The boxes are the last frame's, reused by the next one: read them right away.
 */
export type HoverCard =
  | { kind: 'caption'; target: Extract<GraphTarget, { kind: 'changeset' }>; caption: DrawnBox<NodeLayout> }
  | { kind: 'pointer'; target: PointerCardTarget }
  /** A plain tooltip by the pointer: a header's line cut short, or a button's name. */
  | { kind: 'clippedText'; key: string; text: string };

export function hoverCardFor(target: GraphTarget | null, point: Point, drawn: DrawnTargets | null): HoverCard | null {
  if (!target) return null;
  if (target.kind === 'actions') return { kind: 'clippedText', key: `actions:${actionsKey(target.of)}`, text: ACTIONS_TOOLTIP };
  if (target.kind === 'changeset') {
    const caption = drawn?.captions.find((node) => node.changeset.id === target.id);
    return caption ? { kind: 'caption', target, caption } : { kind: 'pointer', target };
  }
  if (target.kind === 'branch') {
    const { branch } = target.lane;
    if (drawn?.cutBranchNames.at(point)?.item === target.lane) return { kind: 'clippedText', key: `name:${branch.name}`, text: branch.name };
    return drawn?.cutBranchComments.at(point)?.item === target.lane ? { kind: 'clippedText', key: branch.name, text: branch.comment.trim() } : null;
  }
  return { kind: 'pointer', target };
}

/**
 * Whether a pointer card stays where it opened, rather than following the pointer: a merge request's summary, which
 * the pointer moves into to open the request by its title, as its card does in the lists.
 */
export function pointerCardStays(target: PointerCardTarget): boolean {
  return target.kind === 'codeReview' && target.review.mergeRequest !== undefined;
}

/** What a click on the graph does: open a "More actions" button's menu, or select what it lands on. */
export type ClickOutcome = { kind: 'menu'; subject: ActionsSubject } | { kind: 'select'; target: GraphTarget | null };

export function clickOutcome(target: GraphTarget | null): ClickOutcome {
  return target?.kind === 'actions' ? { kind: 'menu', subject: target.of } : { kind: 'select', target };
}

/** What a double-click does: activate what it lands on, zoom in where nothing is, or nothing at all. */
export type DoubleClickOutcome = { kind: 'activate'; target: GraphTarget } | { kind: 'zoom' } | { kind: 'none' };

/**
 * From what is under the pointer with the buttons and without them (`hitTest`'s `buttons`): nothing on a "More
 * actions" button, whose second click lands in the menu its first one opened, or on the button again.
 */
export function doubleClickOutcome(withButtons: GraphTarget | null, withoutButtons: GraphTarget | null): DoubleClickOutcome {
  if (withButtons?.kind === 'actions') return { kind: 'none' };
  return withoutButtons ? { kind: 'activate', target: withoutButtons } : { kind: 'zoom' };
}

/** What the frame lights up under the pointer. */
export type HoverHighlight = Pick<GraphScene, 'hoveredChangeset' | 'hoveredBranch' | 'hoveredReview' | 'hoveredPending' | 'hoveredActions'>;

/**
 * The pointer on a "+N" node lights it as its changeset; on a code review chip, the chip. On a "More actions" button it
 * lights the button and what it belongs to, so a branch's button stays while the pointer moves from the branch onto it.
 */
export function hoverHighlight(hovered: GraphTarget | null): HoverHighlight {
  const on = hovered?.kind === 'actions' ? hovered.of : hovered;
  return {
    hoveredChangeset: on?.kind === 'changeset' ? on.id : on?.kind === 'collapsed' ? on.node.changeset.id : null,
    hoveredBranch: on?.kind === 'branch' ? on.lane.branch.name : null,
    hoveredReview: on?.kind === 'codeReview' ? on.review.id : null,
    hoveredPending: on?.kind === 'pending',
    hoveredActions: hovered?.kind === 'actions' ? actionsKey(hovered.of) : null,
  };
}

/** Names what a hover card is about: the pointer moving within the same card keeps it. */
export function hoverCardKey(target: PointerCardTarget): string {
  switch (target.kind) {
    case 'changeset':
      return `changeset:${target.id}`;
    case 'collapsed':
      return `collapsed:${target.node.changeset.id}`;
    case 'label':
      return `label:${target.label.name}`;
    case 'mergeLink':
      return `link:${target.link.sourceChangeset}:${target.link.destinationChangeset}:${target.link.type}`;
    case 'codeReview':
      return `review:${target.review.id}`;
    case 'pending':
      return 'pending';
    case 'pendingMergeLink':
      return `pendingLink:${target.link.sourceChangeset}:${target.link.type}`;
  }
}

const NODE_HIT_RADIUS = NODE_RADIUS + 4;
/** How far from a link the pointer is still on it: in world px zoomed in, where lines widen too, in screen px zoomed out. */
const LINE_HIT_DISTANCE = 6;

export interface HitOptions {
  /** Whether code review chips are their own target, or part of their header. */
  chips?: boolean;
  /** Whether "More actions" buttons are their own target, or part of what they belong to (for the right-click). */
  buttons?: boolean;
  zoom?: number;
  /** Whether labels are drawn (`detail.labels`): a hidden label can't be hit. */
  labels?: boolean;
  /** Whether merge links are drawn (`detail.mergeLinks`): a hidden link can't be hit. */
  mergeLinks?: boolean;
  /** Whether branch bands are drawn (`detail.bands`): without, a branch is hit only near its line. */
  bands?: boolean;
}

/**
 * Finds what is under a world-space point, most specific first. What moves with the view or is cut to its room
 * (code review chips, branch headers pinned to the edge, comments) is hit where the last frame drew it.
 * Code review chips only react to clicks: for anything else, `chips: false` makes them part of their header. The
 * "More actions" buttons, on top of everything, likewise: `buttons: false` makes each part of what it belongs to.
 */
export function hitTest(
  layout: GraphLayout,
  point: Point,
  drawn: DrawnTargets | null = null,
  { chips = true, buttons = true, zoom = 1, labels = true, mergeLinks = true, bands = true }: HitOptions = {},
): GraphTarget | null {
  const button = drawn?.actionButtons.at(point);
  if (button) return buttons ? { kind: 'actions', of: button.item } : button.item;
  const chip = chips ? drawn?.reviewChips.at(point) : null;
  if (chip) return { kind: 'codeReview', review: chip.item };
  const header = drawn?.branchHeaders.at(point);
  if (header) return { kind: 'branch', lane: header.item };
  const caption = drawn?.captions.at(point);
  const lineHitDistance = LINE_HIT_DISTANCE / Math.min(zoom, 1);
  return (
    hitChangeset(layout, point) ??
    hitPending(layout, point) ??
    (labels ? hitLabel(layout, point) : null) ??
    (caption ? { kind: 'changeset', id: caption.item.changeset.id } : null) ??
    (mergeLinks ? (hitMergeLink(layout, point, lineHitDistance) ?? hitPendingMergeLink(layout, point, lineHitDistance)) : null) ??
    hitLane(layout, point, bands ? BAND_HEIGHT / 2 : lineHitDistance)
  );
}

function hitChangeset(layout: GraphLayout, point: Point): GraphTarget | null {
  const node = layout.nodesByColumn[Math.round((point.x - GRAPH_PADDING.left) / COLUMN_WIDTH)];
  if (!node) return null;
  if (node.collapsed) {
    const inside = Math.abs(columnX(node.column) - point.x) <= COLLAPSED_NODE_HALF_WIDTH && Math.abs(rowY(node.row) - point.y) <= NODE_HIT_RADIUS;
    return inside ? { kind: 'collapsed', node } : null;
  }
  const distance = Math.hypot(columnX(node.column) - point.x, rowY(node.row) - point.y);
  return distance <= NODE_HIT_RADIUS ? { kind: 'changeset', id: node.changeset.id } : null;
}

function hitPending(layout: GraphLayout, point: Point): GraphTarget | null {
  const pending = pendingPoint(layout);
  return pending && Math.hypot(pending.x - point.x, pending.y - point.y) <= NODE_HIT_RADIUS ? { kind: 'pending' } : null;
}

/** How many columns away a long label's chip may still reach. */
const LABEL_REACH_COLUMNS = 3;

/** A chip is centered on its changeset and can be wider than a column: the nearest changesets' chips are looked at. */
function hitLabel(layout: GraphLayout, point: Point): GraphTarget | null {
  const column = Math.round((point.x - GRAPH_PADDING.left) / COLUMN_WIDTH);
  for (let distance = 0; distance <= LABEL_REACH_COLUMNS; distance++) {
    for (const candidate of distance === 0 ? [column] : [column - distance, column + distance]) {
      const node = layout.nodesByColumn[candidate];
      if (!node || !layout.labelsByChangeset.has(node.changeset.id)) continue;
      const chip = labelChips(layout, node).find(
        ({ text, top }) => point.y >= top && point.y <= top + LABEL_HEIGHT && Math.abs(columnX(node.column) - point.x) <= estimatedLabelWidth(text) / 2,
      );
      if (chip) return { kind: 'label', label: chip.label, more: chip.more };
    }
  }
  return null;
}

function hitMergeLink(layout: GraphLayout, point: Point, distance: number): GraphTarget | null {
  for (const link of mergeLinksAcross(layout, point.x - distance, point.x + distance)) {
    if (nearLink(nodePoint(layout, link.sourceChangeset)!, nodePoint(layout, link.destinationChangeset)!, point, distance)) return { kind: 'mergeLink', link };
  }
  return null;
}

/** Whether the point is on the merge link drawn between the two changesets. */
function nearLink(from: Point, to: Point, point: Point, distance: number): boolean {
  const outsideBounds =
    point.x < Math.min(from.x, to.x) - distance ||
    point.x > Math.max(from.x, to.x) + distance ||
    point.y < Math.min(from.y, to.y) - distance ||
    point.y > Math.max(from.y, to.y) + distance;
  return !outsideBounds && distanceToCurve(linkCurve(from, to), point) <= distance;
}

function hitPendingMergeLink(layout: GraphLayout, point: Point, distance: number): GraphTarget | null {
  const to = pendingPoint(layout);
  const link = to && layout.pending!.mergeLinks.find((candidate) => nearLink(nodePoint(layout, candidate.sourceChangeset)!, to, point, distance));
  return link ? { kind: 'pendingMergeLink', link } : null;
}

/**
 * A branch is its band, or, without bands, its line: `halfHeight` is how far from the line's height it still answers
 * (its header card is hit where it was drawn).
 */
function hitLane(layout: GraphLayout, point: Point, halfHeight: number): GraphTarget | null {
  const row = Math.round((point.y - GRAPH_PADDING.top) / ROW_HEIGHT);
  const lane = layout.lanesByRow.get(row)?.find((candidate) => {
    const shape = laneShape(candidate);
    return Math.abs(point.y - shape.y) <= halfHeight && point.x >= shape.left && point.x <= shape.right;
  });
  return lane ? { kind: 'branch', lane } : null;
}
