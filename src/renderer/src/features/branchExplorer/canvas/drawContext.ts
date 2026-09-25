import type { GraphChangeset } from '@shared/domain/branchExplorer';
import type { CodeReview } from '@shared/domain/codeReview';
import type { GraphLayout } from '../model/layoutGraph';
import type { SearchHighlight } from '../model/searchGraph';
import type { GraphPalette } from './graphPalette';
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
  hoveredChangeset: number | null;
  /** The code review whose chip is under the pointer. */
  hoveredReview: number | null;
  homeChangeset: number | null;
  /** The branch the workspace is on, emphasized. */
  currentBranch: string | null;
  /** When set, changesets by other authors fade out. */
  highlightedAuthor: string | null;
  /** While searching, what matched; everything else fades. */
  search: SearchHighlight | null;
  /** Progress of the ping around the current search hit: 0 just landed, 1 settled. */
  searchPing: number;
  /** The newest code review of each branch, shown as a chip in its header card. */
  reviews: ReadonlyMap<string, CodeReview>;
}

/** A code review chip where it was drawn this frame (world coordinates), so a click on it can open the review. */
export interface DrawnReviewChip {
  review: CodeReview;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Opacity of what the author filter or a search pushes into the background. */
export const DIMMED_ALPHA = 0.25;

export function isChangesetDimmed({ highlightedAuthor, search }: GraphScene, changeset: GraphChangeset): boolean {
  return (highlightedAuthor !== null && changeset.owner !== highlightedAuthor) || (search !== null && !search.changesets.has(changeset.id));
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
  /** Changeset comments under the nodes. */
  comments: boolean;
}

export interface DrawContext {
  ctx: CanvasRenderingContext2D;
  scene: GraphScene;
  visible: VisibleArea;
  detail: DetailLevel;
  /** Filled while drawing. */
  reviewChips: DrawnReviewChip[];
}

export function detailLevel(zoom: number, options: GraphViewOptions): DetailLevel {
  return {
    text: zoom >= 0.45,
    avatars: options.showAvatars && zoom >= 0.55,
    comments: options.showComments && zoom >= 0.8,
  };
}
