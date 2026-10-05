import type { Virtualizer } from '@pierre/diffs';
import { ArrowDown, ArrowUp, GitCompareArrows } from 'lucide-react';
import { useEffect, useState, type RefObject } from 'react';
import type { ChangedLine, DiffSide } from './changeBlocks';
import type { DiffLayout } from './diffPreferencesStore';
import type { MovedBlock } from './movedBlocks';
import { labelSpot, ribbonBox, ribbonPath, sameLayout, type Box, type LabelSpot, type Span } from './movedCodeLayout';
import { lineRowSelector, paneRect } from './pierreDom';
import { pierreLinePosition } from './pierreLinePosition';
import styles from './MovedCode.module.css';

interface MovedCodeProps {
  /** The scrolling element around the diff, which holds its shadow root and this overlay. */
  containerRef: RefObject<HTMLElement | null>;
  /** The diff's shadow root, once it's there (`useDiffShadowRoot`). */
  root: ShadowRoot | null;
  /** The diff's virtualizer: where the places of a move not rendered yet will be. */
  virtualizer: Virtualizer;
  moves: MovedBlock[];
  layout: DiffLayout;
  /** The move under the pointer, lit in both places. */
  hovered: MovedBlock | undefined;
  onHover: (move: MovedBlock | undefined) => void;
  /** Takes the view to a move's place on `side`. */
  onGoTo: (move: MovedBlock, side: DiffSide) => void;
  /** Compares a move's two places, to see what changed on the way. */
  onCompare: (move: MovedBlock) => void;
}

/** Where a move's places are on screen, and its labels. */
interface MoveOnScreen {
  move: MovedBlock;
  deletions: Span;
  additions: Span;
  labels: Record<DiffSide, PlacedLabel | null>;
}

/** A label where it goes, short (its arrow and line number, the rest in its tooltip) in a pane too narrow for words. */
interface PlacedLabel extends LabelSpot {
  short: boolean;
}

interface Layout {
  moves: MoveOnScreen[];
  /** Side by side, the strip at the right end of the removed side's pane the hovered move's ribbon goes over. */
  lane: { left: number; width: number } | null;
}

const NOTHING: Layout = { moves: [], lane: null };
/**
 * How far into the removed side's pane the ribbon reaches: its lines' right ends, where code is least likely to be.
 * The panes keep no room between them for it: that room would open and close as code is moved and saved.
 */
const RIBBON_WIDTH = 24;
/** Narrower than this, a pane's code would hide behind a label in words. */
const SHORT_LABEL_PANE_WIDTH = 320;
const OTHER_SIDE: Record<DiffSide, DiffSide> = { deletions: 'additions', additions: 'deletions' };

/**
 * The places of each move, joined. Each place has a label naming the line the code went to or came from, which takes
 * the view there, and a button comparing both places, to see what changed on the way. Pointing at a label or the moved code lights the move up in both places (`onHover`) and, side by
 * side, draws a ribbon joining them over the panes' seam, gone once the pointer leaves.
 */
export function MovedCode({ containerRef, root, virtualizer, moves, layout, hovered, onHover, onGoTo, onCompare }: MovedCodeProps) {
  const shown = useMovesOnScreen(containerRef, root, virtualizer, moves, layout);
  if (shown.moves.length === 0) return null;
  return (
    <div className={styles.layer}>
      {shown.lane && <Ribbon lane={shown.lane} move={shown.moves.find((onScreen) => onScreen.move === hovered)} />}
      {shown.moves.flatMap((onScreen) =>
        (['deletions', 'additions'] as const).map((side) => {
          const spot = onScreen.labels[side];
          if (!spot) return null;
          const { move } = onScreen;
          const other = OTHER_SIDE[side];
          const Arrow = onScreen[other].top < onScreen[side].top ? ArrowUp : ArrowDown;
          const line = move[other].start;
          const text = side === 'deletions' ? `Moved to line ${line}` : `Moved from line ${line}`;
          return (
            <div
              key={`${side}:${move[side].start}`}
              className={styles.label}
              data-anchor={spot.anchor}
              data-hovered={move === hovered ? '' : undefined}
              style={{ top: spot.top, left: spot.x }}
              onPointerEnter={() => onHover(move)}
              onPointerLeave={() => onHover(undefined)}
            >
              <button type="button" className={styles.goTo} aria-label={text} data-tip={spot.short ? text : undefined} onClick={() => onGoTo(move, other)}>
                <Arrow size={12} strokeWidth={2.25} />
                <span>{spot.short ? line : text}</span>
              </button>
              <button type="button" className={styles.compare} aria-label="Compare both places" data-tip="Compare both places" onClick={() => onCompare(move)}>
                <GitCompareArrows size={12} strokeWidth={2.25} />
              </button>
            </div>
          );
        }),
      )}
    </div>
  );
}

/** The hovered move's ribbon, from its removed place's rows to its added place's, over the end of the removed side's pane. */
function Ribbon({ lane, move }: { lane: NonNullable<Layout['lane']>; move: MoveOnScreen | undefined }) {
  if (!move) return null;
  const box = ribbonBox(move.deletions, move.additions);
  return (
    <svg className={styles.ribbon} style={{ left: lane.left, top: box.top, width: lane.width, height: box.bottom - box.top }} aria-hidden>
      <path d={ribbonPath(move.deletions, move.additions, lane.width)} />
    </svg>
  );
}

/**
 * Measures where the moves are in the container's scrolled content, again whenever its size or the rows rendered
 * change (a big diff renders the lines in view only; typing, wrapping and expanding move them).
 */
function useMovesOnScreen(containerRef: RefObject<HTMLElement | null>, root: ShadowRoot | null, virtualizer: Virtualizer, moves: MovedBlock[], layout: DiffLayout): Layout {
  const [shown, setShown] = useState<Layout>(NOTHING);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !root || moves.length === 0) return setShown(NOTHING);
    let frame = 0;
    const measure = (): void => {
      frame = 0;
      const next = measureMoves(container, root, virtualizer, moves, layout);
      // Rows come and go as the diff scrolls; the moves stay where they were most of the time.
      setShown((current) => (sameLayout(current, next) ? current : next));
    };
    const schedule = (): void => {
      frame ||= requestAnimationFrame(measure);
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(container);
    const mutations = new MutationObserver(schedule);
    mutations.observe(root, { childList: true, subtree: true });
    measure();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
    };
  }, [containerRef, root, virtualizer, moves, layout]);

  return shown;
}

function measureMoves(container: HTMLElement, root: ShadowRoot, virtualizer: Virtualizer, moves: MovedBlock[], layout: DiffLayout): Layout {
  const view = container.getBoundingClientRect();
  const toContent = (rect: DOMRect): Box => ({
    top: rect.top - view.top + container.scrollTop,
    bottom: rect.bottom - view.top + container.scrollTop,
    left: rect.left - view.left + container.scrollLeft,
    right: rect.right - view.left + container.scrollLeft,
  });
  const fileContainer = container.querySelector('diffs-container');
  const rowHeight = root.querySelector('[data-line]')?.getBoundingClientRect().height || 20;
  const linePosition = (line: ChangedLine): number | undefined => (fileContainer ? pierreLinePosition(virtualizer, fileContainer, line) : undefined);
  /** The gaps in the other pane, cut to the part in sight: a pane whose lines scroll sideways has gaps as wide as its longest line. */
  const gapsAcross = (side: DiffSide): Box[] => {
    const otherPane = layout === 'split' ? root.querySelector(`[data-${OTHER_SIDE[side]}]`) : null;
    if (!otherPane) return [];
    const { left, right } = toContent(paneRect(otherPane));
    return [...otherPane.querySelectorAll('[data-content-buffer]')].map((gap) => {
      const box = toContent(gap.getBoundingClientRect());
      return { ...box, left: Math.max(box.left, left), right: Math.min(box.right, right) };
    });
  };

  /** Where a place is, from its rows when they're rendered, else from where Pierre lays them out; its label once they're rendered. */
  const place = (move: MovedBlock, side: DiffSide): { span: Span; label: PlacedLabel | null } | null => {
    const { start, count } = move[side];
    const first = { side, lineNumber: start };
    const last = { side, lineNumber: start + count - 1 };
    const firstRow = root.querySelector(lineRowSelector(first));
    const lastRow = root.querySelector(lineRowSelector(last));
    const top = firstRow ? toContent(firstRow.getBoundingClientRect()).top : linePosition(first);
    const lastTop = lastRow ? undefined : linePosition(last);
    const bottom = lastRow ? toContent(lastRow.getBoundingClientRect()).bottom : lastTop === undefined ? undefined : lastTop + rowHeight;
    if (top === undefined || bottom === undefined) return null;
    const span = { top, bottom };
    const pane = firstRow && lastRow ? firstRow.closest('[data-code]') : null;
    if (!pane) return { span, label: null };
    const paneBox = paneRect(pane);
    return { span, label: { ...labelSpot(span, gapsAcross(side), toContent(paneBox).right, rowHeight), short: paneBox.width < SHORT_LABEL_PANE_WIDTH } };
  };

  const onScreen = moves.flatMap((move): MoveOnScreen[] => {
    const deletions = place(move, 'deletions');
    const additions = place(move, 'additions');
    if (!deletions || !additions) return [];
    return [{ move, deletions: deletions.span, additions: additions.span, labels: { deletions: deletions.label, additions: additions.label } }];
  });
  return { moves: onScreen, lane: layout === 'split' ? ribbonLane(root, toContent) : null };
}

/** The strip the ribbon goes over: the right end of the removed side's pane, up to the seam with the added side. */
function ribbonLane(root: ShadowRoot, toContent: (rect: DOMRect) => Box): Layout['lane'] {
  const removedPane = root.querySelector('[data-deletions]');
  if (!removedPane) return null;
  const seam = toContent(paneRect(removedPane)).right;
  return { left: seam - RIBBON_WIDTH, width: RIBBON_WIDTH };
}
