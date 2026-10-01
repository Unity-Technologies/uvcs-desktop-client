import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import type { MenuEntry } from '../../../lib/actions';
import { subscribeToAvatars } from '../../../lib/avatars/avatarImages';
import { MAIN_FOCUS } from '../../../lib/mainFocus';
import { ActionContextMenu } from '../../../ui/menu/ActionContextMenu';
import { TooltipBubble } from '../../../ui/TooltipBubble';
import type { GraphLayout } from '../model/layoutGraph';
import { captionMetrics, captionOnScreen } from './captionCard';
import type { DrawnTargets, GraphScene } from './drawContext';
import { DrawnBoxes } from './drawnBoxes';
import { drawGraph } from './drawGraph';
import { createGraphCanvasHandle, type GraphCanvasHandle } from './graphCanvasHandle';
import { hitTest, hoverCardFor, hoverCardKey, hoverHighlight, type GraphTarget, type HoverCard, type PointerCardTarget } from './graphTargets';
import { GraphTooltip, HOVER_CARD_ATTRIBUTE, type TooltipAnchor } from './GraphTooltip';
import { graphExtent } from './laneShape';
import { awayFromNewest, newestEnd } from './newestEnd';
import { NewestEndButton } from './NewestEndButton';
import { viewportAfterLayout } from './placeAfterLayout';
import { followPointerDrag } from './pointerDrag';
import { useCanvasSize } from './useCanvasSize';
import { useCanvasTip } from './useCanvasTip';
import { useGraphPalette } from './useGraphPalette';
import { useGraphViewport } from './useGraphViewport';
import { useHoverCard } from './useHoverCard';
import { useSearchPing } from './useSearchPing';
import { useWheel } from './useWheel';
import { toWorld, type Size } from './viewport';
import { wheelGesture } from './wheelGesture';
import styles from './GraphCanvas.module.css';

/** Scene fields owned by the view; the canvas adds the viewport, size, palette, hover state and animations. */
export type GraphHighlights = Pick<
  GraphScene,
  | 'selectedChangeset'
  | 'selectedBranch'
  | 'selectedPending'
  | 'homeChangeset'
  | 'pendingChangeCount'
  | 'currentBranch'
  | 'highlightedAuthors'
  | 'search'
  | 'searchQuery'
  | 'options'
  | 'reviews'
>;

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

/** The hover card on screen: what it is about, where the pointer was, and the caption it lies on, if any. */
interface ShownHoverCard {
  key: string;
  target: PointerCardTarget;
  x: number;
  y: number;
  anchor: TooltipAnchor | null;
}

const DOUBLE_CLICK_ZOOM = 1.4;

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
  /** What the pointer is on, highlighted; the hover card has its own life (`useHoverCard`). */
  const [hovered, setHovered] = useState<GraphTarget | null>(null);
  const hoverCard = useHoverCard<ShownHoverCard>();
  const card = hoverCard.card;
  /** The whole text of a branch comment cut in its header, while the pointer is on it. */
  const clippedTip = useCanvasTip();
  /** Whether the view is back in older history, the newest changesets off screen to the right. */
  const [awayFromEnd, setAwayFromEnd] = useState(false);

  const hover = hoverHighlight(hovered);
  const { hoveredChangeset, hoveredBranch, hoveredReview, hoveredPending } = hover;
  /** What the next frame draws, read by callbacks that outlive this render. */
  const sceneRef = useRef({ layout, highlights, palette, hover });
  sceneRef.current = { layout, highlights, palette, hover };
  /** Where the last frame drew what the pointer can land on. */
  const drawnRef = useRef<DrawnTargets>({
    reviewChips: new DrawnBoxes(),
    branchHeaders: new DrawnBoxes(),
    cutBranchNames: new DrawnBoxes(),
    cutBranchComments: new DrawnBoxes(),
    captions: new DrawnBoxes(),
  });

  const { close: closeHoverCard } = hoverCard;
  const { hide: hideClippedTip } = clippedTip;
  const clearHover = useCallback(() => {
    setHovered(null);
    closeHoverCard();
    hideClippedTip();
  }, [closeHoverCard, hideClippedTip]);

  const drawNow = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    const ctx = canvasRef.current?.getContext('2d');
    const scene = sceneRef.current;
    if (!ctx || !scene.palette || sizeRef.current.width === 0) return;
    drawGraph(
      ctx,
      {
        ...scene.highlights,
        ...scene.hover,
        layout: scene.layout,
        palette: scene.palette,
        viewport: view.viewportRef.current,
        size: sizeRef.current,
        searchPing: searchPingRef.current,
      },
      window.devicePixelRatio,
      drawnRef.current,
    );
  }, []);

  const scheduleDraw = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(drawNow);
  }, [drawNow]);

  const view = useGraphViewport(
    () => graphExtent(sceneRef.current.layout),
    () => sizeRef.current,
    () => {
      // Whatever moves the graph moves it away from the card's anchor.
      clearHover();
      scheduleDraw();
      updateAwayFromEnd();
    },
  );
  const searchPingRef = useSearchPing(highlights.search?.active ?? null, scheduleDraw);
  // Only reads refs: every caller sees the current graph, viewport and size.
  function updateAwayFromEnd(): void {
    setAwayFromEnd(awayFromNewest(sceneRef.current.layout, view.viewportRef.current, sizeRef.current));
  }

  useEffect(scheduleDraw, [layout, highlights, palette, hoveredChangeset, hoveredBranch, hoveredReview, hoveredPending, scheduleDraw]);
  // A filter can reshape, shrink or grow the graph: keep the user's place in it (unless a glide is taking them
  // somewhere) and keep it on screen.
  const laidOutRef = useRef(layout);
  useEffect(() => {
    const before = laidOutRef.current;
    laidOutRef.current = layout;
    // The viewport may stay as it was while the graph's end moved.
    updateAwayFromEnd();
    if (before === layout || view.gliding() || sizeRef.current.width === 0) return view.keepInBounds();
    view.jumpTo(viewportAfterLayout(before, layout, view.viewportRef.current, sizeRef.current, sceneRef.current.highlights));
  }, [layout, view]);
  // Avatars arrive in the background; repaint as each one lands.
  useEffect(() => subscribeToAvatars(scheduleDraw), [scheduleDraw]);

  useImperativeHandle(
    ref,
    () =>
      createGraphCanvasHandle({
        layout,
        view,
        size: () => sizeRef.current,
        canvas: () => canvasRef.current,
        container: () => containerRef.current,
        clearHover,
        setContextTarget: (target) => {
          contextTargetRef.current = target;
        },
        whenSized: (apply, after) => {
          const waiting = pendingViewRef.current;
          pendingViewRef.current =
            after && waiting
              ? () => {
                  waiting();
                  apply();
                }
              : apply;
        },
      }),
    [layout, view, clearHover],
  );

  const onResize = useCallback(() => {
    const pending = pendingViewRef.current;
    pendingViewRef.current = null;
    if (pending) pending();
    else view.keepInBounds();
    updateAwayFromEnd();
    // Resizing cleared the canvas: redraw before this frame is painted, or it flashes blank.
    drawNow();
  }, [view, drawNow]);

  useCanvasSize(containerRef, canvasRef, sizeRef, onResize);
  useWheel(containerRef, (event, x, y) => {
    view.inertia.cancel();
    const gesture = wheelGesture(event);
    if (gesture.kind === 'zoomStep') return view.zoomStep(x, y, gesture.factor);
    if (gesture.kind === 'pinch') return view.pinchZoom(x, y, gesture.factor);
    view.stop();
    view.panBy(gesture.dx, gesture.dy);
  });

  const localPoint = (clientX: number, clientY: number): { x: number; y: number } => {
    const bounds = containerRef.current!.getBoundingClientRect();
    return { x: clientX - bounds.left, y: clientY - bounds.top };
  };

  /** Code review chips only react to clicks; for anything else they are part of their branch's card. */
  const targetAt = (clientX: number, clientY: number, withChips = true): GraphTarget | null => {
    const point = localPoint(clientX, clientY);
    const viewport = view.viewportRef.current;
    return hitTest(layout, toWorld(viewport, point.x, point.y), drawnRef.current, { chips: withChips, zoom: viewport.zoom });
  };

  /** A changeset's card opens over its caption, in its font and color; any other card by the pointer. */
  const anchorFor = (subject: Exclude<HoverCard, { kind: 'clippedText' }>): TooltipAnchor | null => {
    const { palette, highlights } = sceneRef.current;
    if (subject.kind !== 'caption' || !palette) return null;
    const { ascent } = captionMetrics(palette.fonts.caption, palette.captionFontSize);
    const selected = highlights.selectedChangeset === subject.target.id;
    return { kind: 'caption', ...captionOnScreen(subject.caption, view.viewportRef.current, ascent), color: selected ? palette.textPrimary : palette.textSecondary };
  };

  /** In the hover card the pointer selects and copies its text. */
  const inHoverCard = (event: React.SyntheticEvent): boolean => (event.target as Element).closest?.(`[${HOVER_CARD_ATTRIBUTE}]`) != null;

  /** Floating controls over the canvas handle their own pointer events. */
  const onCanvas = (event: React.SyntheticEvent): boolean => event.target === canvasRef.current;

  const onPointerDown = (event: React.PointerEvent): void => {
    if (!onCanvas(event)) return;
    clippedTip.hide();
    containerRef.current?.focus();
    if (event.button === 2) {
      // The menu covers the hover card's place: it would linger under the menu.
      clearHover();
      contextTargetRef.current = targetAt(event.clientX, event.clientY, false);
      onSelect(contextTargetRef.current);
      return;
    }
    if (event.button !== 0) return;

    // Grabbing the graph catches it mid-glide.
    view.stop();
    view.inertia.sample(event.clientX, event.clientY, event.timeStamp);
    followPointerDrag(event, {
      onDrag: (dx, dy, move) => {
        containerRef.current?.setAttribute('data-panning', 'true');
        view.panBy(dx, dy);
        // Pointer moves are coalesced to one per frame; the raw samples make the release velocity accurate.
        const samples = move.getCoalescedEvents?.() ?? [];
        for (const sample of samples.length > 0 ? samples : [move]) view.inertia.sample(sample.clientX, sample.clientY, sample.timeStamp);
      },
      onDragEnd: () => {
        containerRef.current?.removeAttribute('data-panning');
        view.inertia.release();
      },
      onClick: (up) => onSelect(targetAt(up.clientX, up.clientY)),
    });
  };

  const onPointerMove = (event: React.PointerEvent): void => {
    if (event.buttons !== 0) return;
    // In the card the pointer selects text: the card and what it is about stay as they are.
    if (inHoverCard(event)) return hoverCard.keepOpen();
    const point = localPoint(event.clientX, event.clientY);
    const target = onCanvas(event) ? targetAt(event.clientX, event.clientY) : null;
    setHovered(target);
    const subject = hoverCardFor(target, toWorld(view.viewportRef.current, point.x, point.y), drawnRef.current);
    if (subject?.kind === 'clippedText') {
      clippedTip.show(subject.key, subject.text, event.clientX, event.clientY);
      return hoverCard.requestClose();
    }
    clippedTip.hide();
    if (!subject) return hoverCard.requestClose();
    const anchor = anchorFor(subject);
    hoverCard.show({ key: hoverCardKey(subject.target), target: subject.target, anchor, ...point }, anchor === null);
  };

  const onDoubleClick = (event: React.MouseEvent): void => {
    if (!onCanvas(event)) return;
    const target = targetAt(event.clientX, event.clientY, false);
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
        role="application"
        aria-roledescription="graph"
        aria-label="Branch Explorer. Arrow keys walk the changesets, Home and End go to the ends of the branch, Enter diffs the selection, H goes to the workspace. Question mark lists every shortcut."
        {...MAIN_FOCUS}
        data-hovering={hovered !== null}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerLeave={() => {
          setHovered(null);
          hoverCard.requestClose();
          clippedTip.hide();
        }}
        onContextMenu={(event) => {
          // Nothing under the pointer: no menu (preventing the default also stops the menu from opening).
          if (!onCanvas(event) || !contextTargetRef.current) event.preventDefault();
        }}
        onDoubleClick={onDoubleClick}
      >
        <canvas ref={canvasRef} className={styles.canvas} />
        {card && palette && (
          <GraphTooltip
            target={card.target}
            layout={layout}
            palette={palette}
            pendingChangeCount={highlights.pendingChangeCount}
            x={card.x}
            y={card.y}
            anchor={card.anchor}
            containerWidth={sizeRef.current.width}
          />
        )}
        {clippedTip.tip && <TooltipBubble {...clippedTip.tip} wide />}
        <NewestEndButton shown={awayFromEnd} onClick={() => view.glideTo(newestEnd(layout, view.viewportRef.current, sizeRef.current))} />
        {children}
      </div>
    </ActionContextMenu>
  );
});
