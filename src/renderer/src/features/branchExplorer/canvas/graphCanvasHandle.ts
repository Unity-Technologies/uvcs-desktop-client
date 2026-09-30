import type { GraphSelection } from '../graphSelection';
import type { GraphLayout } from '../model/layoutGraph';
import type { Point } from './curves';
import { COLUMN_WIDTH, nodePoint } from './geometry';
import type { GraphTarget } from './graphTargets';
import type { GraphViewport } from './graphViewport';
import { graphExtent } from './laneShape';
import { newestEnd } from './newestEnd';
import { menuPoint, selectionPoint } from './selectionPoint';
import { centerOn, fitToScreen, frameOn, openingViewport, revealPoint, type Size } from './viewport';

/** What the Branch Explorer view asks of its canvas: where to look, and the keyboard's menu. */
export interface GraphCanvasHandle {
  /** Scrolls just enough to show the changeset. */
  revealChangeset: (id: number) => void;
  /** Glides just enough to show the changeset or the pending changes: the view following the keyboard. */
  follow: (selection: GraphSelection) => void;
  /** How many columns a screen holds at the current zoom. */
  columnsOnScreen: () => number;
  /** Opens the context menu of a changeset or branch where it is drawn, as a right click on it would. */
  openContextMenu: (target: GraphTarget) => void;
  /** Scrolls just enough to show the branch's header card. */
  revealBranch: (name: string) => void;
  /** Centers the view on a changeset, the pending changes or a branch's header card. */
  centerOn: (selection: GraphSelection) => void;
  /** Glides to a changeset or a branch's header card, centered and readable: a reveal from another view. */
  frameChangeset: (id: number) => void;
  frameBranch: (name: string) => void;
  /** The first view of a graph, focused on a changeset, the pending changes or a branch. */
  showOpeningView: (focus: GraphSelection) => void;
  fit: () => void;
  /** Glides to the newest end of the history, at the same zoom. */
  showNewest: () => void;
  /** Glides the zoom by `factor` around the middle of the canvas. */
  zoomBy: (factor: number) => void;
  /** Gives the keyboard back to the graph. */
  focus: () => void;
}

/** What the handle moves and reads: the canvas's viewport, its size, its elements and its hover. */
export interface GraphCanvasParts {
  layout: GraphLayout;
  view: GraphViewport;
  size: () => Size;
  canvas: () => HTMLCanvasElement | null;
  container: () => HTMLDivElement | null;
  /** Whatever moves the view closes the hover card and tooltip. */
  clearHover: () => void;
  /** Which target the next context menu is for. */
  setContextTarget: (target: GraphTarget) => void;
  /**
   * A view asked for before the canvas knows its size: the canvas applies it on its first resize. `after` keeps what
   * was already waiting and runs it first; otherwise it is replaced.
   */
  whenSized: (apply: () => void, after?: 'afterWaiting') => void;
}

export function createGraphCanvasHandle({ layout, view, size, canvas, container, clearHover, setContextTarget, whenSized }: GraphCanvasParts): GraphCanvasHandle {
  const sized = (): boolean => size().width > 0;
  const branchPoint = (name: string): Point | null => selectionPoint(layout, { kind: 'branch', name });

  const reveal = (point: Point | null): void => {
    if (!point) return;
    clearHover();
    view.jumpTo(revealPoint(view.viewportRef.current, point.x, point.y, size()));
  };

  const frame = (point: Point | null): void => {
    if (!point) return;
    clearHover();
    const glideToFramed = (): void => view.glideTo(frameOn(view.viewportRef.current, point.x, point.y, size()));
    // Before the canvas has a size there is nothing to glide from: once it has one, glide from the opening view.
    if (sized()) glideToFramed();
    else whenSized(glideToFramed, 'afterWaiting');
  };

  return {
    frameChangeset: (id) => frame(nodePoint(layout, id)),
    frameBranch: (name) => frame(branchPoint(name)),
    revealChangeset: (id) => reveal(nodePoint(layout, id)),
    revealBranch: (name) => reveal(branchPoint(name)),
    follow: (selection) => {
      const point = selectionPoint(layout, selection);
      if (!point) return;
      clearHover();
      const current = view.viewportRef.current;
      const next = revealPoint(current, point.x, point.y, size());
      if (next !== current) view.glideTo(next);
    },
    columnsOnScreen: () => size().width / (COLUMN_WIDTH * view.viewportRef.current.zoom),
    openContextMenu: (target) => {
      const element = canvas();
      const point = menuPoint(layout, target);
      if (!element || !point) return;
      const { zoom, panX, panY } = view.viewportRef.current;
      const bounds = element.getBoundingClientRect();
      setContextTarget(target);
      clearHover();
      element.dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: bounds.left + point.x * zoom + panX, clientY: bounds.top + point.y * zoom + panY }),
      );
    },
    centerOn: (selection) => {
      const point = selectionPoint(layout, selection);
      if (point) view.jumpTo(centerOn(view.viewportRef.current, point.x, point.y, size()));
    },
    showOpeningView: (focus) => {
      const show = (): void => {
        const point = selectionPoint(layout, focus);
        if (point) view.jumpTo(openingViewport(graphExtent(layout), size(), point.x, point.y));
      };
      if (sized()) show();
      else whenSized(show);
    },
    fit: () => view.jumpTo(fitToScreen(graphExtent(layout), size(), view.viewportRef.current)),
    showNewest: () => view.glideTo(newestEnd(layout, view.viewportRef.current, size())),
    zoomBy: (factor) => view.zoomStep(size().width / 2, size().height / 2, factor),
    focus: () => container()?.focus(),
  };
}
