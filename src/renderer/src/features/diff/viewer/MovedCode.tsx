import type { Virtualizer } from '@pierre/diffs';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useEffect, useState, type RefObject } from 'react';
import type { ChangedLine, DiffSide } from './changeBlocks';
import type { DiffLayout } from './diffPreferencesStore';
import type { MovedBlock } from './movedBlocks';
import { labelSpot, ribbonBox, ribbonPath, type Box, type LabelSpot, type Span } from './movedCodeLayout';
import { lineRowSelector, paneRect, pierreShadowRoot } from './pierreDom';
import { pierreLinePosition } from './pierreLinePosition';
import styles from './MovedCode.module.css';

interface MovedCodeProps {
  /** The scrolling element around the diff, which holds its shadow root and this overlay. */
  containerRef: RefObject<HTMLElement | null>;
  /** The diff's virtualizer: where the places of a move not rendered yet will be. */
  virtualizer: Virtualizer;
  moves: MovedBlock[];
  layout: DiffLayout;
  /** The move under the pointer, lit in both places. */
  hovered: MovedBlock | undefined;
  onHover: (move: MovedBlock | undefined) => void;
  /** Takes the view to a move's place on `side`. */
  onGoTo: (move: MovedBlock, side: DiffSide) => void;
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
  /** Side by side, the room between the panes the ribbons go in. */
  gap: { left: number; width: number } | null;
}

const NOTHING: Layout = { moves: [], gap: null };
/** Narrower than this, a pane's code would hide behind a label in words. */
const SHORT_LABEL_PANE_WIDTH = 420;
const OTHER_SIDE: Record<DiffSide, DiffSide> = { deletions: 'additions', additions: 'deletions' };

/**
 * The places of each move, joined. Each place has a label naming the line the code went to or came from, which takes
 * the view there; side by side, a ribbon in the room between the panes joins the two places. Pointing at a label, a
 * ribbon or the moved code lights the move up in both places (`onHover`).
 */
export function MovedCode({ containerRef, virtualizer, moves, layout, hovered, onHover, onGoTo }: MovedCodeProps) {
  const shown = useMovesOnScreen(containerRef, virtualizer, moves, layout);
  if (shown.moves.length === 0) return null;
  return (
    <div className={styles.layer}>
      {shown.gap &&
        shown.moves.map(({ move, deletions, additions }) => {
          const box = ribbonBox(deletions, additions);
          return (
            <svg
              key={`ribbon:${move.deletions.start}`}
              className={styles.ribbon}
              data-hovered={move === hovered ? '' : undefined}
              style={{ left: shown.gap!.left, top: box.top, width: shown.gap!.width, height: box.bottom - box.top }}
              aria-hidden
            >
              <path d={ribbonPath(deletions, additions, shown.gap!.width)} onPointerEnter={() => onHover(move)} onPointerLeave={() => onHover(undefined)} />
            </svg>
          );
        })}
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
            <button
              key={`${side}:${move[side].start}`}
              type="button"
              className={styles.label}
              aria-label={text}
              data-tip={spot.short ? text : undefined}
              data-anchor={spot.anchor}
              data-hovered={move === hovered ? '' : undefined}
              style={{ top: spot.top, left: spot.x }}
              onPointerEnter={() => onHover(move)}
              onPointerLeave={() => onHover(undefined)}
              onClick={() => onGoTo(move, other)}
            >
              <Arrow size={12} strokeWidth={2.25} />
              <span>{spot.short ? line : text}</span>
            </button>
          );
        }),
      )}
    </div>
  );
}

/**
 * Measures where the moves are in the container's scrolled content, again whenever its size or the rows rendered
 * change (a big diff renders the lines in view only; typing, wrapping and expanding move them).
 */
function useMovesOnScreen(containerRef: RefObject<HTMLElement | null>, virtualizer: Virtualizer, moves: MovedBlock[], layout: DiffLayout): Layout {
  const [shown, setShown] = useState<Layout>(NOTHING);

  useEffect(() => {
    const container = containerRef.current;
    const root = pierreShadowRoot(container);
    if (!container || !root || moves.length === 0) return setShown(NOTHING);
    let frame = 0;
    const measure = (): void => {
      frame = 0;
      const next = measureMoves(container, root, virtualizer, moves, layout);
      // Rows come and go as the diff scrolls; the moves stay where they were most of the time.
      setShown((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
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
  }, [containerRef, virtualizer, moves, layout]);

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
  const gapsAcross = (side: DiffSide): Box[] =>
    layout === 'split' ? [...root.querySelectorAll(`[data-${OTHER_SIDE[side]}] [data-content-buffer]`)].map((gap) => toContent(gap.getBoundingClientRect())) : [];

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
  return { moves: onScreen, gap: layout === 'split' ? ribbonGap(root, toContent) : null };
}

/** The room between the panes: from the right edge of the removed side's pane to the added side's line numbers. */
function ribbonGap(root: ShadowRoot, toContent: (rect: DOMRect) => Box): Layout['gap'] {
  const removedPane = root.querySelector('[data-deletions]');
  const addedNumbers = root.querySelector('[data-additions] [data-gutter]');
  if (!removedPane || !addedNumbers) return null;
  const left = toContent(paneRect(removedPane)).right;
  const width = toContent(addedNumbers.getBoundingClientRect()).left - left;
  return width > 0 ? { left, width } : null;
}
