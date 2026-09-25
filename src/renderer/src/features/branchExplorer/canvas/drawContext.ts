import type { GraphLayout } from '../model/layoutGraph';
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
  homeChangeset: number | null;
  /** The branch the workspace is on, emphasized. */
  currentBranch: string | null;
  /** When set, changesets by other authors fade out. */
  highlightedAuthor: string | null;
  searchHits: ReadonlySet<number>;
  activeSearchHit: number | null;
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
}

export function detailLevel(zoom: number, options: GraphViewOptions): DetailLevel {
  return {
    text: zoom >= 0.45,
    avatars: options.showAvatars && zoom >= 0.55,
    comments: options.showComments && zoom >= 0.8,
  };
}
