import { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { TooltipBubble } from '../../../ui/TooltipBubble';
import type { GraphLayout } from '../model/layoutGraph';
import type { SearchHit } from '../model/searchGraph';
import { branchColor, type GraphPalette } from '../canvas/graphPalette';
import type { GraphViewport } from '../canvas/graphViewport';
import { followPointerDrag } from '../canvas/pointerDrag';
import { useCanvasSize } from '../canvas/useCanvasSize';
import { useWheel } from '../canvas/useWheel';
import type { Size } from '../canvas/viewport';
import { activityCurve } from './activityCurve';
import { drawTimeline, measureAxisText } from './drawTimeline';
import { columnAtStrip, stripXOfColumn, timelineAxis } from './timelineAxis';
import { axisLabelCandidates, LOCAL_CALENDAR, spacedAxisLabels } from './timelineCalendar';
import { timelineCard } from './timelineCard';
import { viewportAtColumn, viewportCenteredAt, viewportFrame, viewportPannedBy, viewportShowingRow, viewportWithEdgeAt } from './timelineFrame';
import { timelineHistory, timelineShare } from './timelineHistory';
import { branchLifetime, hitTicks, homeMark, labelTicks, searchHitColumns, timelineGaps } from './timelineMarks';
import { clickedColumn, gapsClearOfHome, ghostFrame, homeSpots, timelineCursor, timelinePress, timelineTargetAt, type TimelineSpots, type TimelineTarget } from './timelineTargets';
import { timelineWheel, zoomAnchorX } from './timelineWheel';
import styles from './GraphTimeline.module.css';

interface GraphTimelineProps {
  layout: GraphLayout;
  palette: GraphPalette;
  /** The canvas's viewport, which the strip shows as its frame and moves. */
  view: GraphViewport;
  /** The canvas's size. */
  screenSize: () => Size;
  /** Whose changesets are the share under the curve: the user's, or the people filter's picks. */
  owners: ReadonlySet<string>;
  shareIsMine: boolean;
  searchHits: readonly SearchHit[];
  selectedChangeset: number | null;
  selectedBranch: string | null;
  homeChangeset: number | null;
  pendingChangeCount: number;
  /** Whether it slides in as it shows: the user just showed it. */
  slideIn: boolean;
  /** Gives the keyboard to the graph, as pressing the canvas does. */
  focusGraph: () => void;
}

/** What the canvas tells the strip: its viewport moved or its size changed, so the frame moves. */
export interface GraphTimelineHandle {
  viewportChanged: () => void;
}

interface Hover {
  target: TimelineTarget;
  x: number;
  clientX: number;
  clientY: number;
}

/**
 * The Timeline: an overview of the history the graph loaded, its activity as a curve, and the viewport as a frame to
 * drag (docs/features/branch-explorer.md "Timeline"). What it shows comes from pure modules beside it; it draws, and
 * turns the pointer into viewport moves.
 */
export const GraphTimeline = forwardRef<GraphTimelineHandle, GraphTimelineProps>(function GraphTimeline(props, ref) {
  const { layout, palette, view, screenSize, owners, shareIsMine, searchHits, selectedChangeset, selectedBranch, homeChangeset, pendingChangeCount, slideIn, focusGraph } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef<Size>({ width: 0, height: 0 });
  const frameRequest = useRef(0);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<Hover | null>(null);

  // Measured once per layout, share and width: never per frame or pointer move.
  const history = useMemo(() => timelineHistory(layout), [layout]);
  const share = useMemo(() => timelineShare(history, owners), [history, owners]);
  const axis = useMemo(() => timelineAxis(layout, width), [layout, width]);
  const curve = useMemo(() => activityCurve(history, share, axis), [history, share, axis]);
  const labels = useMemo(() => labelTicks(history, axis), [history, axis]);
  const allGaps = useMemo(() => timelineGaps(history, axis), [history, axis]);
  const axisCandidates = useMemo(() => axisLabelCandidates(history.columnTimes, LOCAL_CALENDAR), [history]);
  const axisLabels = useMemo(
    () => spacedAxisLabels(axisCandidates, { xOf: (column) => stripXOfColumn(axis, column), widthOf: (text) => measureAxisText(text, palette), stripWidth: width }),
    [axisCandidates, axis, palette, width],
  );
  const hits = useMemo(() => hitTicks(searchHitColumns(layout, searchHits), axis), [layout, searchHits, axis]);
  const home = useMemo(() => homeMark(layout, history, homeChangeset), [layout, history, homeChangeset]);
  const homePlaces = useMemo(() => homeSpots(home, axis, curve), [home, axis, curve]);
  const gaps = useMemo(() => gapsClearOfHome(allGaps, homePlaces.home), [allGaps, homePlaces]);

  const spots = (): TimelineSpots => ({
    frame: viewportFrame(axis, view.viewportRef.current, screenSize()),
    labels,
    gaps,
    hits,
    ...homePlaces,
  });

  const selectedColumn = selectedChangeset === null ? undefined : layout.nodes.get(selectedChangeset)?.column;
  const lifetime = branchLifetime(layout, axis, selectedBranch);
  const drawRef = useRef<() => void>(() => {});
  drawRef.current = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || width === 0) return;
    const { frame } = spots();
    drawTimeline(
      ctx,
      {
        width,
        palette,
        curve,
        frame,
        ghost: hover ? ghostFrame(hover.target, frame, hover.x) : null,
        axisLabels,
        labels,
        gaps,
        hits,
        ...homePlaces,
        homeOlderThanRange: home?.kind === 'olderThanRange',
        newestMainX: history.newestMainColumn === null ? null : stripXOfColumn(axis, history.newestMainColumn),
        selectedChangesetX: selectedColumn === undefined ? null : stripXOfColumn(axis, selectedColumn),
        selectedBranch: lifetime && selectedBranch !== null ? { ...lifetime, color: branchColor(palette, selectedBranch) } : null,
      },
      window.devicePixelRatio,
    );
  };
  // Every render may change what is drawn (the selection, a search, the hover's ghost frame): drawn before it is painted.
  useLayoutEffect(() => drawRef.current());

  const scheduleDraw = useCallback(() => {
    cancelAnimationFrame(frameRequest.current);
    frameRequest.current = requestAnimationFrame(() => drawRef.current());
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      viewportChanged: () => {
        // A card about the frame would tell what it showed before.
        setHover(null);
        scheduleDraw();
      },
    }),
    [scheduleDraw],
  );

  const onResize = useCallback(() => {
    setWidth(sizeRef.current.width);
    drawRef.current();
  }, []);
  useCanvasSize(containerRef, canvasRef, sizeRef, onResize);

  useWheel(containerRef, (event, x) => {
    const gesture = timelineWheel(event);
    view.inertia.cancel();
    const screen = screenSize();
    if (gesture.kind === 'pan') {
      view.stop();
      view.panBy(gesture.dx, 0);
      return;
    }
    const anchor = zoomAnchorX(axis, view.viewportRef.current, screen, x);
    if (gesture.kind === 'zoomStep') view.zoomStep(anchor, screen.height / 2, gesture.factor);
    else view.pinchZoom(anchor, screen.height / 2, gesture.factor);
  });

  const localX = (clientX: number): number => clientX - containerRef.current!.getBoundingClientRect().left;
  const localY = (clientY: number): number => clientY - containerRef.current!.getBoundingClientRect().top;

  /** After a drag, the row of the changeset the frame landed on comes into view. */
  const revealLandedRow = (): void => {
    const { frame } = spots();
    const column = columnAtStrip(axis, (frame.left + frame.right) / 2);
    const current = view.viewportRef.current;
    const shown = viewportShowingRow(layout, current, screenSize(), column);
    if (shown !== current) view.glideTo(shown);
  };

  const onPointerDown = (event: React.PointerEvent): void => {
    if (event.button !== 0) return;
    focusGraph();
    const x = localX(event.clientX);
    const target = timelineTargetAt(spots(), x, localY(event.clientY));
    const press = timelinePress(target);
    view.stop();
    setHover(null);
    followPointerDrag(event, {
      onDrag: (dx, _dy, move) => {
        containerRef.current?.setAttribute('data-dragging', press.kind);
        const current = view.viewportRef.current;
        if (press.kind === 'pan') view.jumpTo(viewportPannedBy(current, axis, dx));
        else if (press.kind === 'zoom') view.jumpTo(viewportWithEdgeAt(current, axis, screenSize(), press.edge, localX(move.clientX)));
        else view.jumpTo(viewportCenteredAt(current, axis, screenSize(), localX(move.clientX)));
      },
      onDragEnd: () => {
        containerRef.current?.removeAttribute('data-dragging');
        revealLandedRow();
      },
      onClick: () => view.glideTo(viewportAtColumn(layout, view.viewportRef.current, axis, screenSize(), clickedColumn(target, x, axis, home))),
    });
  };

  const onPointerMove = (event: React.PointerEvent): void => {
    if (event.buttons !== 0) return;
    const x = localX(event.clientX);
    setHover({ target: timelineTargetAt(spots(), x, localY(event.clientY)), x, clientX: event.clientX, clientY: event.clientY });
  };

  const card =
    hover &&
    timelineCard(hover.target, hover.x, {
      history,
      share,
      shareIsMine,
      axis,
      calendar: LOCAL_CALENDAR,
      frame: spots().frame,
      zoom: view.viewportRef.current.zoom,
      home,
      pendingChangeCount,
    });

  return (
    <div
      ref={containerRef}
      className={styles.timeline}
      data-slide-in={slideIn}
      data-cursor={timelineCursor(hover?.target ?? null)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setHover(null)}
    >
      <canvas ref={canvasRef} className={styles.canvas} role="img" aria-label="Timeline" />
      {card && <TooltipBubble text={card.title} sub={card.lines.join('\n') || undefined} pointerX={hover.clientX} pointerY={hover.clientY} />}
    </div>
  );
});
