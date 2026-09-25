import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import type { MenuEntry } from '../../../lib/actions';
import { subscribeToAvatars } from '../../../lib/avatars/avatarImages';
import { ActionContextMenu } from '../../../ui/menu/ActionContextMenu';
import type { GraphLayout } from '../model/layoutGraph';
import type { GraphScene } from './drawContext';
import { drawGraph } from './drawGraph';
import { graphSize, headerTop } from './geometry';
import { hitTest, nodePoint, type GraphTarget } from './graphTargets';
import { GraphTooltip } from './GraphTooltip';
import { laneShape } from './laneShape';
import { useGraphPalette } from './useGraphPalette';
import { useGraphViewport } from './useGraphViewport';
import { useSearchPing } from './useSearchPing';
import { centerOn, fitToScreen, frameOn, openingViewport, revealPoint, toWorld, type Size, type Viewport } from './viewport';
import { isDiscreteWheel, wheelZoomFactor } from './zoom';
import styles from './GraphCanvas.module.css';

/** Scene fields owned by the view; the canvas adds the viewport, size, palette, hover state and animations. */
export type GraphHighlights = Pick<
  GraphScene,
  'selectedChangeset' | 'selectedBranch' | 'homeChangeset' | 'currentBranch' | 'highlightedAuthor' | 'search' | 'options'
>;

export interface GraphCanvasHandle {
  /** Scrolls just enough to show the changeset. */
  revealChangeset: (id: number) => void;
  /** Scrolls just enough to show the branch's header card. */
  revealBranch: (name: string) => void;
  centerOnChangeset: (id: number) => void;
  /** Glides to a changeset or a branch's header card, centered and readable: a reveal from another view. */
  frameChangeset: (id: number) => void;
  frameBranch: (name: string) => void;
  /** The first view of a graph, focused on a changeset. */
  showOpeningView: (focusId: number) => void;
  fit: () => void;
  /** Glides the zoom by `factor` around the middle of the canvas. */
  zoomBy: (factor: number) => void;
}

interface GraphCanvasProps {
  layout: GraphLayout;
  highlights: GraphHighlights;
  onSelect: (target: GraphTarget | null) => void;
  onActivate: (target: GraphTarget) => void;
  /** Builds the context menu for what was right-clicked. */
  contextMenu: (target: GraphTarget | null) => MenuEntry[];
  /** Floating controls drawn over the canvas. */
  children?: ReactNode;
}

const DRAG_THRESHOLD = 4;
const DOUBLE_CLICK_ZOOM = 1.4;
/** Where in a header card a reveal aims: far enough in to show the start of the name. */
const HEADER_REVEAL_INSET = 60;

export const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(function GraphCanvas(
  { layout, highlights, onSelect, onActivate, contextMenu, children },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef<Size>({ width: 0, height: 0 });
  const frameRef = useRef(0);
  const contextTargetRef = useRef<GraphTarget | null>(null);
  /** A viewport change requested before the canvas knew its size; applied on the first resize. */
  const pendingViewRef = useRef<(() => void) | null>(null);
  const palette = useGraphPalette(containerRef);
  const [hover, setHover] = useState<{ target: GraphTarget; x: number; y: number } | null>(null);

  const hoveredChangeset = hover?.target.kind === 'changeset' ? hover.target.id : hover?.target.kind === 'collapsed' ? hover.target.node.changeset.id : null;
  const sceneRef = useRef({ layout, highlights, palette, hoveredChangeset });
  sceneRef.current = { layout, highlights, palette, hoveredChangeset };

  const scheduleDraw = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      const ctx = canvasRef.current?.getContext('2d');
      const { layout: currentLayout, highlights: currentHighlights, palette: currentPalette, hoveredChangeset: hovered } = sceneRef.current;
      if (!ctx || !currentPalette || sizeRef.current.width === 0) return;
      drawGraph(
        ctx,
        {
          ...currentHighlights,
          layout: currentLayout,
          viewport: view.viewportRef.current,
          size: sizeRef.current,
          palette: currentPalette,
          hoveredChangeset: hovered,
          searchPing: searchPingRef.current,
        },
        window.devicePixelRatio,
      );
    });
  }, []);

  const view = useGraphViewport(
    () => graphSize(sceneRef.current.layout.columnCount, sceneRef.current.layout.rowCount),
    () => sizeRef.current,
    () => {
      // Whatever moves the graph moves it away from the tooltip's anchor.
      setHover(null);
      scheduleDraw();
    },
  );
  const searchPingRef = useSearchPing(highlights.search?.active ?? null, scheduleDraw);

  useEffect(scheduleDraw, [layout, highlights, palette, hoveredChangeset, scheduleDraw]);
  // A filter can shrink or grow the graph: keep it on screen.
  useEffect(() => view.keepInBounds(), [layout, view]);
  // Avatars arrive in the background; repaint as each one lands.
  useEffect(() => subscribeToAvatars(scheduleDraw), [scheduleDraw]);

  const center = (): { x: number; y: number } => ({ x: sizeRef.current.width / 2, y: sizeRef.current.height / 2 });

  useImperativeHandle(
    ref,
    () => {
      const reveal = (x: number, y: number): void => {
        setHover(null);
        view.jumpTo(revealPoint(view.viewportRef.current, x, y, sizeRef.current));
      };
      const frame = (point: { x: number; y: number } | null): void => {
        if (!point) return;
        setHover(null);
        const framed = (): Viewport => frameOn(view.viewportRef.current, point.x, point.y, sizeRef.current);
        // Before the canvas has a size there is nothing to glide from: once it has one, glide from the opening view.
        const opening = pendingViewRef.current;
        if (sizeRef.current.width === 0) {
          pendingViewRef.current = () => {
            opening?.();
            view.glideTo(framed());
          };
        } else view.glideTo(framed());
      };
      const headerPoint = (name: string): { x: number; y: number } | null => {
        const lane = layout.lanesByBranch.get(name);
        if (!lane) return null;
        const shape = laneShape(lane);
        return { x: shape.left + HEADER_REVEAL_INSET, y: headerTop(shape.y) };
      };
      return {
        frameChangeset: (id) => frame(nodePoint(layout, id)),
        frameBranch: (name) => frame(headerPoint(name)),
        revealChangeset: (id) => {
          const point = nodePoint(layout, id);
          if (point) reveal(point.x, point.y);
        },
        revealBranch: (name) => {
          const point = headerPoint(name);
          if (point) reveal(point.x, point.y);
        },
        centerOnChangeset: (id) => {
          const point = nodePoint(layout, id);
          if (point) view.jumpTo(centerOn(view.viewportRef.current, point.x, point.y, sizeRef.current));
        },
        showOpeningView: (focusId) => {
          const show = (): void => {
            const point = nodePoint(layout, focusId);
            if (point) view.jumpTo(openingViewport(graphSize(layout.columnCount, layout.rowCount), sizeRef.current, point.x, point.y));
          };
          if (sizeRef.current.width === 0) pendingViewRef.current = show;
          else show();
        },
        fit: () => view.jumpTo(fitToScreen(graphSize(layout.columnCount, layout.rowCount), sizeRef.current)),
        zoomBy: (factor) => view.zoomStep(center().x, center().y, factor),
      };
    },
    [layout, view],
  );

  const onResize = useCallback(() => {
    const pending = pendingViewRef.current;
    pendingViewRef.current = null;
    if (pending) pending();
    else view.keepInBounds();
    scheduleDraw();
  }, [view, scheduleDraw]);

  useCanvasSize(containerRef, canvasRef, sizeRef, onResize);
  useWheel(containerRef, (event, x, y) => {
    view.inertia.cancel();
    if (event.ctrlKey || event.metaKey) {
      // A wheel notch glides; a trackpad pinch follows the fingers.
      if (isDiscreteWheel(event.deltaY, event.deltaMode)) view.zoomStep(x, y, wheelZoomFactor(event.deltaY, event.deltaMode));
      else view.pinchZoom(x, y, Math.exp(-event.deltaY * 0.01));
      return;
    }
    view.stop();
    const sideways = event.shiftKey && event.deltaX === 0;
    view.panBy(-(sideways ? event.deltaY : event.deltaX), -(sideways ? 0 : event.deltaY));
  });

  const localPoint = (clientX: number, clientY: number): { x: number; y: number } => {
    const bounds = containerRef.current!.getBoundingClientRect();
    return { x: clientX - bounds.left, y: clientY - bounds.top };
  };

  const targetAt = (clientX: number, clientY: number): GraphTarget | null => {
    const point = localPoint(clientX, clientY);
    return hitTest(layout, toWorld(view.viewportRef.current, point.x, point.y));
  };

  /** Floating controls over the canvas handle their own pointer events. */
  const onCanvas = (event: React.SyntheticEvent): boolean => event.target === canvasRef.current;

  const onPointerDown = (event: React.PointerEvent): void => {
    if (!onCanvas(event)) return;
    containerRef.current?.focus();
    if (event.button === 2) {
      contextTargetRef.current = targetAt(event.clientX, event.clientY);
      onSelect(contextTargetRef.current);
      return;
    }
    if (event.button !== 0) return;

    // Grabbing the graph catches it mid-glide.
    view.stop();
    view.inertia.sample(event.clientX, event.clientY, event.timeStamp);
    const start = { x: event.clientX, y: event.clientY };
    let last = start;
    let dragging = false;
    const onMove = (move: PointerEvent): void => {
      if (!dragging && Math.hypot(move.clientX - start.x, move.clientY - start.y) < DRAG_THRESHOLD) return;
      dragging = true;
      containerRef.current?.setAttribute('data-panning', 'true');
      view.panBy(move.clientX - last.x, move.clientY - last.y);
      last = { x: move.clientX, y: move.clientY };
      // Pointer moves are coalesced to one per frame; the raw samples make the release velocity accurate.
      const samples = move.getCoalescedEvents?.() ?? [];
      for (const sample of samples.length > 0 ? samples : [move]) view.inertia.sample(sample.clientX, sample.clientY, sample.timeStamp);
    };
    const onUp = (up: PointerEvent): void => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      containerRef.current?.removeAttribute('data-panning');
      if (dragging) view.inertia.release();
      else onSelect(targetAt(up.clientX, up.clientY));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const onPointerMove = (event: React.PointerEvent): void => {
    if (event.buttons !== 0) return;
    const target = onCanvas(event) ? targetAt(event.clientX, event.clientY) : null;
    setHover(target && { target, ...localPoint(event.clientX, event.clientY) });
  };

  const onDoubleClick = (event: React.MouseEvent): void => {
    if (!onCanvas(event)) return;
    const target = targetAt(event.clientX, event.clientY);
    if (target) return onActivate(target);
    const point = localPoint(event.clientX, event.clientY);
    view.zoomStep(point.x, point.y, DOUBLE_CLICK_ZOOM);
  };

  return (
    <ActionContextMenu entries={() => contextMenu(contextTargetRef.current)}>
      <div
        ref={containerRef}
        className={styles.container}
        tabIndex={0}
        data-hovering={hover !== null}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHover(null)}
        onContextMenu={(event) => {
          // Nothing under the pointer: no menu (preventing the default also stops the menu from opening).
          if (!onCanvas(event) || !contextTargetRef.current) event.preventDefault();
        }}
        onDoubleClick={onDoubleClick}
      >
        <canvas ref={canvasRef} className={styles.canvas} />
        {hover && <GraphTooltip target={hover.target} layout={layout} x={hover.x} y={hover.y} />}
        {children}
      </div>
    </ActionContextMenu>
  );
});

/** Keeps the canvas backing store in sync with its CSS size and the display's pixel ratio. */
function useCanvasSize(
  containerRef: React.RefObject<HTMLDivElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  sizeRef: React.RefObject<Size>,
  onResize: () => void,
): void {
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry!.contentRect;
      sizeRef.current = { width, height };
      canvas.width = Math.round(width * window.devicePixelRatio);
      canvas.height = Math.round(height * window.devicePixelRatio);
      onResize();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef, canvasRef, sizeRef, onResize]);
}

/** Wheel and trackpad events with the pointer position in the container, never zooming the page. */
function useWheel(containerRef: React.RefObject<HTMLDivElement | null>, onWheel: (event: WheelEvent, x: number, y: number) => void): void {
  const handlerRef = useRef(onWheel);
  handlerRef.current = onWheel;
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const listener = (event: WheelEvent): void => {
      event.preventDefault();
      const bounds = container.getBoundingClientRect();
      handlerRef.current(event, event.clientX - bounds.left, event.clientY - bounds.top);
    };
    // Registered natively: React's wheel listeners are passive and cannot prevent page zoom.
    container.addEventListener('wheel', listener, { passive: false });
    return () => container.removeEventListener('wheel', listener);
  }, [containerRef]);
}
