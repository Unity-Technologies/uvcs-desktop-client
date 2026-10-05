import type { Virtualizer } from '@pierre/diffs';
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { ChangedLine, DiffSide, DisplayMeta } from './changeBlocks';
import { scrollToChange } from './changeView';
import type { ComparisonMethod } from './comparisonMethod';
import type { DiffLayout } from './diffPreferencesStore';
import { detectMovedBlocks, moveContaining, type MovedBlock } from './movedBlocks';
import { MovedCode } from './MovedCode';
import { linesOf, movedCodeCss } from './movedCodeCss';
import { movedWordMarks } from './movedWordMarks';
import { useChangeFlash } from './useChangeFlash';
import { useDiffShadowRoot } from './useDiffShadowRoot';
import { useMovedWordMarks } from './useMovedWordMarks';
import { useShadowStyle } from './useShadowStyle';

interface MovedCodeOptions {
  /** The diff shown (`lineDiff`), of the original and the modified text as it is now. */
  diff: DisplayMeta;
  /** How the diff compares lines: moves are found the same way. */
  comparisonMethod: ComparisonMethod;
  layout: DiffLayout;
  /** The scrolling element around the diff, which holds its shadow root. */
  containerRef: RefObject<HTMLElement | null>;
  virtualizer: Virtualizer;
  /** The modified text `diff` is of. */
  diffedText: string;
  /**
   * The modified text as typed. A big text is diffed again only once typing pauses (`diffsEveryKeystroke`): until then
   * its lines move under the moves found, which hide meanwhile.
   */
  typed: string;
}

/**
 * The code a text diff shows moved (`detectMovedBlocks`): in the moved color, the words edited on the way marked
 * (`useMovedWordMarks`), its two places labeled and, side by side, joined by a ribbon while it's hovered (`MovedCode`). A label takes the view to the other place and lights it for a moment.
 * Returns the overlay, to go in the scrolling element.
 */
export function useMovedCode({ diff, comparisonMethod, layout, containerRef, virtualizer, diffedText, typed }: MovedCodeOptions): ReactNode {
  const found = useMemo(() => detectMovedBlocks(diff, comparisonMethod), [diff, comparisonMethod]);
  const moves = diffedText === typed ? found : NO_MOVES;
  const [hovered, setHovered] = useState<MovedBlock | undefined>(undefined);
  const shownHovered = hovered && moves.includes(hovered) ? hovered : undefined;
  const flash = useChangeFlash();
  const root = useDiffShadowRoot(containerRef);
  useShadowStyle(containerRef, `${movedCodeCss(moves, shownHovered)}\n${flash.css}`);
  useHoveredRows(root, moves, setHovered);
  useMovedWordMarks(containerRef, root, useMemo(() => movedWordMarks(diff, moves), [diff, moves]));
  const stopScrolling = useRef<() => void>(undefined);
  useEffect(() => () => stopScrolling.current?.(), []);

  const goTo = (move: MovedBlock, side: DiffSide): void => {
    const container = containerRef.current;
    if (!container) return;
    const lines = linesOf(move, side);
    stopScrolling.current?.();
    stopScrolling.current = scrollToChange(container, { index: 0, lines, newStart: move.additions.start }, virtualizer);
    flash.light(lines);
  };

  return <MovedCode containerRef={containerRef} root={root} virtualizer={virtualizer} moves={moves} layout={layout} hovered={shownHovered} onHover={setHovered} onGoTo={goTo} />;
}

const NO_MOVES: MovedBlock[] = [];

/** Follows the pointer over the diff's rows: the move it's on, if any, is hovered. */
function useHoveredRows(root: ShadowRoot | null, moves: MovedBlock[], setHovered: (move: MovedBlock | undefined) => void): void {
  useEffect(() => {
    if (!root || moves.length === 0) return;
    // The labels set what's hovered too: setting the same move again changes nothing (React drops it).
    const onMove = (event: Event): void => {
      const line = changedLineUnder(event);
      setHovered(line ? moveContaining(moves, line) : undefined);
    };
    const onLeave = (): void => setHovered(undefined);
    root.addEventListener('pointermove', onMove);
    root.host.addEventListener('pointerleave', onLeave);
    return () => {
      root.removeEventListener('pointermove', onMove);
      root.host.removeEventListener('pointerleave', onLeave);
    };
  }, [root, moves, setHovered]);
}

/** The changed line whose row (its code or its number) a pointer event inside the diff is on; null on any other. */
function changedLineUnder(event: Event): ChangedLine | null {
  const row = event.composedPath().find((target): target is HTMLElement => target instanceof HTMLElement && (target.hasAttribute('data-line') || target.hasAttribute('data-column-number')));
  const type = row?.getAttribute('data-line-type');
  if (!row || (type !== 'change-deletion' && type !== 'change-addition')) return null;
  const lineNumber = Number(row.getAttribute('data-line') ?? row.getAttribute('data-column-number'));
  const side: DiffSide = type === 'change-deletion' ? 'deletions' : 'additions';
  return Number.isInteger(lineNumber) ? { side, lineNumber } : null;
}
