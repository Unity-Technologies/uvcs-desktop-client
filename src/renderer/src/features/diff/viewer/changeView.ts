import type { Virtualizer } from '@pierre/diffs';
import { prefersReducedMotion } from '../../../lib/reducedMotion';
import type { ChangeBlock, ChangedLine, ChangeRegion } from './changeBlocks';
import { modifiedLineAt } from './changeNavigation';
import { CHANGE_SCROLL_START, changeScrollStep, type ChangeScroll } from './changeScrollPlan';
import { lineOfRow, topProbePoints, type LineAtTop } from './rowPosition';
import { lineRowSelector, pierreShadowRoot } from './pierreDom';
import { pierreLinePosition } from './pierreLinePosition';
import { scrollSmoothlyTo } from './smoothScrollPlan';
import { stopOnUserScroll } from './userScrollStop';

/** What the diff's navigation asks of the diff on screen (`TextDiff`). */
export interface ChangeView {
  /** Brings a change into view, lights it for a moment and, while typing, puts the caret on it. */
  reveal: (change: ChangeRegion) => void;
  /** Brings a change into view as the diff opens, at once, without lighting or picking it. */
  show: (change: ChangeRegion) => void;
  /**
   * Whether the diff opened on a link's lines (`useLineLinks`' `focusLines`) or a row its place goes to
   * (`DiffAnnotations.opensAtRow`), scrolled to them rather than to its first change.
   */
  opensOnLines: () => boolean;
  /** The line of the modified file at the top of the view (`blocks` are the diff's); none before the diff shows. */
  lineAtTop: (blocks: ChangeBlock[]) => number | null;
}

/** Rows of what came before a change, kept in view above it: the Annotate view's too. */
const CONTEXT_ROWS = 3;
/** Frames to wait for the diff to render a change: it may only just have loaded, or render only the lines in view. */
const MAX_FRAMES = 60;

/**
 * Scrolls the diff in `container` so the change starts a few rows from the top, unless it's in view already
 * (`ChangeScroll`). A big diff renders only the lines in view: a change not rendered yet is scrolled to where Pierre
 * lays it out, then placed again on each frame until it stands still (`changeScrollStep`) or the user moves the view
 * (`stopOnUserScroll`). Returns a function that stops it.
 */
export function scrollToChange(container: HTMLElement, change: ChangeRegion, virtualizer: Virtualizer | undefined, why: ChangeScroll): () => void {
  let frames = 0;
  let state = CHANGE_SCROLL_START;
  let frame = 0;
  const attempt = (): void => {
    const root = pierreShadowRoot(container);
    const first = root && rowOf(root, change.lines[0]!);
    const fileContainer = container.querySelector('diffs-container');
    const estimatedTop = virtualizer && fileContainer ? pierreLinePosition(virtualizer, fileContainer, change.lines[0]!) : undefined;
    const view = container.getBoundingClientRect();
    const placeOffset = CONTEXT_ROWS * rowHeight(first ?? root?.querySelector('[data-line]'));
    const decided = changeScrollStep(state, {
      why,
      rowOffset: first ? first.getBoundingClientRect().top - view.top : null,
      placeOffset,
      scrollTop: container.scrollTop,
      maxScroll: container.scrollHeight - container.clientHeight,
      viewHeight: view.height,
      canJump: estimatedTop !== undefined,
    });
    state = decided.state;
    const { step } = decided;
    if (step.kind === 'done') return stopListening();
    if (step.kind === 'rows') {
      stopListening();
      return scrollToRows(container, first!, lastRows(root!, change), step.smooth);
    }
    if (step.kind === 'jump') container.scrollTop = estimatedTop! - placeOffset;
    if (step.kind === 'place') container.scrollTop = step.scrollTop;
    if (++frames < MAX_FRAMES) frame = requestAnimationFrame(attempt);
    else stopListening();
  };
  const stop = (): void => {
    cancelAnimationFrame(frame);
    stopListening();
  };
  const stopListening = stopOnUserScroll(container, stop);
  attempt();
  return stop;
}

/**
 * The first line in view, read from the row there (`topProbePoints`): its own side and number, a removed line's on the
 * original's, and where its row stands.
 */
export function rowAtTopOf(container: HTMLElement): LineAtTop | null {
  const root = pierreShadowRoot(container);
  if (!root) return null;
  const view = container.getBoundingClientRect();
  for (const { x, y } of topProbePoints(view)) {
    const row = root.elementFromPoint(x, y)?.closest<HTMLElement>('[data-line]');
    const line = row && lineOfRow(row.dataset.line, row.dataset.lineType);
    if (!line) continue;
    const box = row.getBoundingClientRect();
    return { line, offset: box.top - view.top, height: box.height };
  }
  return null;
}

/** The line of the modified file at the top of the view (`rowAtTopOf`): a removed line stands where it was. */
export function lineAtTopOf(container: HTMLElement, blocks: ChangeBlock[]): number | null {
  const top = rowAtTopOf(container);
  return top && modifiedLineAt(blocks, top.line.side, top.line.lineNumber);
}

/**
 * Scrolls `container` so the rows from `first` to `last` start a few rows from the top, unless they're all in view:
 * a diff's change, a merged file's conflict.
 */
export function scrollToRows(container: HTMLElement, first: Element, last: Element[], smooth: boolean): void {
  const view = container.getBoundingClientRect();
  const top = first.getBoundingClientRect().top;
  const bottom = Math.max(...[first, ...last].map((row) => row.getBoundingClientRect().bottom));
  if (top >= view.top && bottom <= view.bottom) return;
  const target = container.scrollTop + top - view.top - CONTEXT_ROWS * rowHeight(first);
  // Far away, a smooth scroll would pass through rows a big diff renders one screen after another: it jumps to a quarter
  // of a view short of the change and glides the rest (`smoothScrollPlan`, `GLIDE_SHARE`).
  if (smooth) scrollSmoothlyTo(container, target, prefersReducedMotion());
  else container.scrollTo({ top: target, behavior: 'auto' });
}

/** The rows a change ends on: its last removed line and its last added one (side by side, either may go lower). */
function lastRows(root: ShadowRoot, { lines }: ChangeRegion): Element[] {
  const ends = [lines.findLast((line) => line.side === 'deletions'), lines.findLast((line) => line.side === 'additions')];
  return ends.flatMap((line) => (line ? [rowOf(root, line)].filter((row) => row !== null) : []));
}

function rowOf(root: ShadowRoot, line: ChangedLine): Element | null {
  return root.querySelector(lineRowSelector(line));
}

function rowHeight(row: Element | null | undefined): number {
  const height = row ? parseFloat(getComputedStyle(row).lineHeight) : NaN;
  return Number.isFinite(height) ? height : 20;
}
