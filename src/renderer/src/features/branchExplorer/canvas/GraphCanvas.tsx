import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { MenuEntry } from '../../../lib/actions';
import { ActionContextMenu } from '../../../ui/menu/ActionContextMenu';
import type { GraphLayout } from '../model/layoutGraph';
import type { GraphScene } from './drawContext';
import { drawGraph } from './drawGraph';
import { graphSize } from './geometry';
import { hitTest, nodePoint, type GraphTarget } from './graphTargets';
import { GraphTooltip } from './GraphTooltip';
import { useGraphPalette } from './useGraphPalette';
import { centerOn, fitToScreen, openingViewport, revealPoint, toWorld, zoomAt, type Size, type Viewport } from './viewport';
import styles from './GraphCanvas.module.css';

/** Scene fields owned by the view; the canvas adds the viewport, size, palette and hover state. */
export type GraphHighlights = Pick<
  GraphScene,
  'selectedChangeset' | 'selectedBranch' | 'homeChangeset' | 'currentBranch' | 'highlightedAuthor' | 'searchHits' | 'activeSearchHit' | 'options'
>;

export interface GraphCanvasHandle {
  /** Scrolls just enough to show the changeset. */
  revealChangeset: (id: number) => void;
  centerOnChangeset: (id: number) => void;
  /** The first view of a graph, focused on a changeset. */
  showOpeningView: (focusId: number) => void;
  fit: () => void;
  zoomBy: (factor: number) => void;
}

interface GraphCanvasProps {
  layout: GraphLayout;
  highlights: GraphHighlights;
  onSelect: (target: GraphTarget | null) => void;
  onActivate: (target: GraphTarget) => void;
  /** Builds the context menu for what was right-clicked. */
  contextMenu: (target: GraphTarget | null) => MenuEntry[];
}

const DRAG_THRESHOLD = 4;

export const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(function GraphCanvas(
  { layout, highlights, onSelect, onActivate, contextMenu },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<Viewport>({ panX: 0, panY: 0, zoom: 1 });
  const sizeRef = useRef<Size>({ width: 0, height: 0 });
  const frameRef = useRef(0);
  const contextTargetRef = useRef<GraphTarget | null>(null);
  /** A viewport change requested before the canvas knew its size; applied on the first resize. */
  const pendingViewRef = useRef<(() => void) | null>(null);
  const palette = useGraphPalette(containerRef);
  const [hover, setHover] = useState<{ target: GraphTarget; x: number; y: number } | null>(null);

  const hoveredChangeset = hover?.target.kind === 'changeset' ? hover.target.id : null;
  const sceneRef = useRef({ layout, highlights, palette, hoveredChangeset });
  sceneRef.current = { layout, highlights, palette, hoveredChangeset };

  const scheduleDraw = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      const { layout: currentLayout, highlights: currentHighlights, palette: currentPalette, hoveredChangeset: hovered } = sceneRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx || !currentPalette || sizeRef.current.width === 0) return;
      drawGraph(
        ctx,
        { ...currentHighlights, layout: currentLayout, viewport: viewportRef.current, size: sizeRef.current, palette: currentPalette, hoveredChangeset: hovered },
        window.devicePixelRatio,
      );
    });
  }, []);

  const setViewport = useCallback(
    (viewport: Viewport) => {
      viewportRef.current = viewport;
      scheduleDraw();
    },
    [scheduleDraw],
  );

  useEffect(scheduleDraw, [layout, highlights, palette, hoveredChangeset, scheduleDraw]);

  useImperativeHandle(
    ref,
    () => ({
      revealChangeset: (id) => {
        const point = nodePoint(layout, id);
        if (point) setViewport(revealPoint(viewportRef.current, point.x, point.y, sizeRef.current));
      },
      centerOnChangeset: (id) => {
        const point = nodePoint(layout, id);
        if (point) setViewport(centerOn(viewportRef.current, point.x, point.y, sizeRef.current));
      },
      showOpeningView: (focusId) => {
        const show = (): void => {
          const point = nodePoint(layout, focusId);
          if (point) setViewport(openingViewport(graphSize(layout.columnCount, layout.rowCount), sizeRef.current, point.x, point.y));
        };
        if (sizeRef.current.width === 0) pendingViewRef.current = show;
        else show();
      },
      fit: () => setViewport(fitToScreen(graphSize(layout.columnCount, layout.rowCount), sizeRef.current)),
      zoomBy: (factor) => setViewport(zoomAt(viewportRef.current, factor, sizeRef.current.width / 2, sizeRef.current.height / 2)),
    }),
    [layout, setViewport],
  );

  const onResize = useCallback(() => {
    const pending = pendingViewRef.current;
    pendingViewRef.current = null;
    if (pending) pending();
    else scheduleDraw();
  }, [scheduleDraw]);

  useCanvasSize(containerRef, canvasRef, sizeRef, onResize);
  useWheelZoomAndPan(containerRef, viewportRef, setViewport);

  const targetAt = (clientX: number, clientY: number): GraphTarget | null => {
    const bounds = containerRef.current!.getBoundingClientRect();
    return hitTest(layout, toWorld(viewportRef.current, clientX - bounds.left, clientY - bounds.top));
  };

  const onPointerDown = (event: React.PointerEvent): void => {
    containerRef.current?.focus();
    if (event.button === 2) {
      contextTargetRef.current = targetAt(event.clientX, event.clientY);
      onSelect(contextTargetRef.current);
      return;
    }
    if (event.button !== 0) return;

    const start = { x: event.clientX, y: event.clientY, viewport: viewportRef.current };
    let dragging = false;
    const onMove = (move: PointerEvent): void => {
      const dx = move.clientX - start.x;
      const dy = move.clientY - start.y;
      if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      dragging = true;
      containerRef.current?.setAttribute('data-panning', 'true');
      setViewport({ ...start.viewport, panX: start.viewport.panX + dx, panY: start.viewport.panY + dy });
    };
    const onUp = (up: PointerEvent): void => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      containerRef.current?.removeAttribute('data-panning');
      if (!dragging) onSelect(targetAt(up.clientX, up.clientY));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const onPointerMove = (event: React.PointerEvent): void => {
    if (event.buttons !== 0) return;
    const target = targetAt(event.clientX, event.clientY);
    const bounds = containerRef.current!.getBoundingClientRect();
    setHover(target && { target, x: event.clientX - bounds.left, y: event.clientY - bounds.top });
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
          if (!contextTargetRef.current) event.preventDefault();
        }}
        onDoubleClick={(event) => {
          const target = targetAt(event.clientX, event.clientY);
          if (target) onActivate(target);
        }}
      >
        <canvas ref={canvasRef} className={styles.canvas} />
        {hover && <GraphTooltip target={hover.target} layout={layout} x={hover.x} y={hover.y} />}
      </div>
    </ActionContextMenu>
  );
});

/** Keeps the canvas backing store in sync with its CSS size and the display's pixel ratio. */
function useCanvasSize(
  containerRef: React.RefObject<HTMLDivElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  sizeRef: React.MutableRefObject<Size>,
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

/** Wheel and trackpad: scroll pans; ⌘/Ctrl + wheel (and pinch) zooms around the pointer. */
function useWheelZoomAndPan(
  containerRef: React.RefObject<HTMLDivElement | null>,
  viewportRef: React.MutableRefObject<Viewport>,
  setViewport: (viewport: Viewport) => void,
): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const viewport = viewportRef.current;
      if (event.ctrlKey || event.metaKey) {
        const bounds = container.getBoundingClientRect();
        setViewport(zoomAt(viewport, Math.exp(-event.deltaY * 0.01), event.clientX - bounds.left, event.clientY - bounds.top));
        return;
      }
      const deltaX = event.shiftKey && event.deltaX === 0 ? event.deltaY : event.deltaX;
      const deltaY = event.shiftKey && event.deltaX === 0 ? 0 : event.deltaY;
      setViewport({ ...viewport, panX: viewport.panX - deltaX, panY: viewport.panY - deltaY });
    };
    // Registered natively: React's wheel listeners are passive and cannot prevent page zoom.
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [containerRef, viewportRef, setViewport]);
}
