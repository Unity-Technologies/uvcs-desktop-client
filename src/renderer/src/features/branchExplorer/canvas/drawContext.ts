import type { GraphChangeset } from '@shared/domain/branchExplorer';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import type { GraphLayout, Lane, NodeLayout } from '../model/layoutGraph';
import type { SearchHighlight } from '../model/searchGraph';
import type { DrawnBoxes } from './drawnBoxes';
import type { GraphPalette } from './graphPalette';
import type { Pen } from './pen';
import type { Size, Viewport } from './viewport';

/** What the user chose to see in the graph. */
export interface GraphViewOptions {
  showComments: boolean;
  showAvatars: boolean;
}

/** Everything that affects how the graph looks in one frame. */
export interface GraphScene {
  layout: GraphLayout;
  viewport: Viewport;
  size: Size;
  palette: GraphPalette;
  options: GraphViewOptions;
  selectedChangeset: number | null;
  selectedBranch: string | null;
  /** Whether the pending changes are selected. */
  selectedPending: boolean;
  hoveredChangeset: number | null;
  /** The branch whose header or band is under the pointer. */
  hoveredBranch: string | null;
  /** The code review whose chip is under the pointer. */
  hoveredReview: number | null;
  homeChangeset: number | null;
  /** How many changes the workspace has pending, counted in the pending changeset (`layout.pending`). */
  pendingChangeCount: number;
  /** Whether the pointer is on the pending changeset. */
  hoveredPending: boolean;
  /** The branch the workspace is on, emphasized. */
  currentBranch: string | null;
  /** When set, changesets by anyone else fade out (the people filter). */
  highlightedAuthors: ReadonlySet<string> | null;
  /** While searching, what matched; everything else fades. */
  search: SearchHighlight | null;
  /** What was typed in the search, its words marked in the branch headers while `search` is set. */
  searchQuery: string;
  /** Progress of the ping around the current search hit: 0 just landed, 1 settled. */
  searchPing: number;
  /** The newest code review of each branch, shown as a chip in its header card. */
  reviews: ReadonlyMap<number, CodeReviewSummary>;
}

/** Where the pointer targets were drawn in the last frame (world coordinates). Owned by the canvas, refilled by every frame. */
export interface DrawnTargets {
  reviewChips: DrawnBoxes<CodeReviewSummary>;
  /** Branch header cards where they are drawn, pinned to the left edge or not. */
  branchHeaders: DrawnBoxes<Lane>;
  /** The comment lines of branch headers that don't show the whole comment (cut to fit, or more lines below), as wide as the text drawn. */
  cutBranchComments: DrawnBoxes<Lane>;
  /** Changeset comments, as wide as the text drawn. */
  captions: DrawnBoxes<NodeLayout>;
}

/** Opacity of the changesets the author filter or a search pushes into the background. */
export const DIMMED_ALPHA = 0.18;
/** Headers and labels without a hit fade less: they are how one finds the way, they must stay locatable. */
export const GHOST_ALPHA = 0.3;
/** Bands and links recede with the changesets while a search picks some out. */
export const STRUCTURE_DIMMED_ALPHA = 0.12;

export function isChangesetDimmed({ highlightedAuthors, search }: GraphScene, changeset: GraphChangeset): boolean {
  return (highlightedAuthors !== null && !highlightedAuthors.has(changeset.owner)) || (search !== null && !search.changesets.has(changeset.id));
}

/** The part of the world currently on screen. */
export interface VisibleArea {
  left: number;
  top: number;
  right: number;
  bottom: number;
  firstColumn: number;
  lastColumn: number;
}

/** How much detail fits at the current zoom. */
export interface DetailLevel {
  /** Branch headers, labels and other text. */
  text: boolean;
  /** Avatars with initials instead of plain dots. */
  avatars: boolean;
  /** Opacity of the changeset comments under the nodes; 0 when hidden. */
  captions: number;
}

export interface DrawContext {
  ctx: CanvasRenderingContext2D;
  /**
   * Places shapes and text in the coordinates of the phase being drawn: world positions while drawing the world,
   * handed to the canvas relative to the frame's origin (`OriginPen`); the context itself while drawing on the screen.
   */
  pen: Pen;
  scene: GraphScene;
  visible: VisibleArea;
  detail: DetailLevel;
  pixelRatio: number;
  drawn: DrawnTargets;
}

/** Comments are fully shown from this zoom, and fade out as a whole just below it: never one by one. */
const CAPTIONS_FULL_ZOOM = 0.8;
const CAPTIONS_FADE_SPAN = 0.15;

export function detailLevel(zoom: number, options: GraphViewOptions): DetailLevel {
  return {
    text: zoom >= 0.45,
    avatars: options.showAvatars && zoom >= 0.55,
    captions: options.showComments ? captionAlpha(zoom) : 0,
  };
}

/** Opacity of the comment layer at a zoom: a soft exit instead of a pop while zooming through the threshold. */
export function captionAlpha(zoom: number): number {
  return Math.min(1, Math.max(0, (zoom - (CAPTIONS_FULL_ZOOM - CAPTIONS_FADE_SPAN)) / CAPTIONS_FADE_SPAN));
}
