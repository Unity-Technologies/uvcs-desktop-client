import type { GraphLayout } from '../model/layoutGraph';
import type { GraphPalette } from './graphPalette';
import type { Size, Viewport } from './viewport';

/** Everything that affects how the graph looks in one frame. */
export interface GraphScene {
  layout: GraphLayout;
  viewport: Viewport;
  size: Size;
  palette: GraphPalette;
  selectedChangeset: number | null;
  selectedBranch: string | null;
  hoveredChangeset: number | null;
  homeChangeset: number | null;
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

export interface DrawContext {
  ctx: CanvasRenderingContext2D;
  scene: GraphScene;
  visible: VisibleArea;
  /** Below this zoom, text becomes unreadable and is skipped. */
  showText: boolean;
}

export const TEXT_ZOOM_THRESHOLD = 0.45;
