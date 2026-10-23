import type { Virtualizer } from '@pierre/diffs';
import { prefersReducedMotion } from '../../../lib/reducedMotion';
import type { ChangeBlock, ChangedLine, ChangeRegion } from './changeBlocks';
import { modifiedLineAt } from './changeNavigation';
import { lineRowSelector, pierreShadowRoot } from './pierreDom';
import { pierreLinePosition } from './pierreLinePosition';

/** What the diff's navigation asks of the diff on screen (`TextDiff`). */
export interface ChangeView {
  /** Brings a change into view, lights it for a moment and, while typing, puts the caret on it. */
  reveal: (change: ChangeRegion) => void;
  /** Brings a change into view as the diff opens, at once, without lighting or picking it. */
  show: (change: ChangeRegion) => void;
  /** Whether the diff opened on a link's lines (`useLineLinks`' `focusLines`), scrolled to them (`scrollToLine`). */
  opensOnLines: () => boolean;
  /** The line of the modified file at the top of the view (`blocks` are the diff's); none before the diff shows. */
  lineAtTop: (blocks: ChangeBlock[]) => number | null;
}

/** Rows of what came before a change, kept in view above it: the Annotate view's too. */
const CONTEXT_ROWS = 3;
/** Frames to wait for the diff to render a change: it may only just have loaded, or render only the lines in view. */
const MAX_FRAMES = 60;

/**
 * Why a change is scrolled to: a move to it (a short way smoothly, unless it's all in view), or the diff opening on it
 * (at once, unless it starts in view: a collapsed diff's first hunk, taller than the view, keeps the bar above it).
 */
export type ChangeScroll = 'move' | 'open';

/**
 * Scrolls the diff in `container` so the change starts a few rows from the top, unless it's in view already
 * (`ChangeScroll`). A big diff renders only the lines in view: a change not rendered yet is scrolled to where Pierre
 * lays it out, then set right once its rows render. Returns a function that stops it.
 */
export function scrollToChange(container: HTMLElement, change: ChangeRegion, virtualizer: Virtualizer | undefined, why: ChangeScroll): () => void {
  let frames = 0;
  let jumped = false;
  let frame = 0;
  const attempt = (): void => {
    const root = pierreShadowRoot(container);
    const first = root && rowOf(root, change.lines[0]!);
    // Where Pierre estimated it (`jumped`), a row in view may still be a few rows off: set right all the same.
    if (first && why === 'open' && !jumped && startsInView(container, first)) return;
    if (root && first) return scrollToRows(container, first, lastRows(root, change), why === 'move' && !jumped);
    const fileContainer = container.querySelector('diffs-container');
    const top = !jumped && virtualizer && fileContainer ? pierreLinePosition(virtualizer, fileContainer, change.lines[0]!) : undefined;
    if (top !== undefined) {
      container.scrollTop = top - CONTEXT_ROWS * rowHeight(root?.querySelector('[data-line]'));
      jumped = true;
    }
    if (++frames < MAX_FRAMES) frame = requestAnimationFrame(attempt);
  };
  attempt();
  return () => cancelAnimationFrame(frame);
}

/**
 * The line of the modified file at the top of the view, read from the row there (on the modified side, side by
 * side): a removed line stands where it was.
 */
export function lineAtTopOf(container: HTMLElement, blocks: ChangeBlock[]): number | null {
  const root = pierreShadowRoot(container);
  if (!root) return null;
  const view = container.getBoundingClientRect();
  const x = view.left + view.width * 0.75;
  // The first rows may be a separator of collapsed lines, or the gap across from removed lines.
  for (let y = view.top + 1; y < Math.min(view.bottom, view.top + 240); y += 8) {
    const row = root.elementFromPoint(x, y)?.closest<HTMLElement>('[data-line]');
    const lineNumber = Number(row?.dataset.line);
    if (row && lineNumber > 0) return modifiedLineAt(blocks, row.dataset.lineType === 'change-deletion' ? 'deletions' : 'additions', lineNumber);
  }
  return null;
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
  // Smoothly only a short way: far away it would scroll through rows a big diff renders one screen after another.
  const near = Math.abs(target - container.scrollTop) < view.height * 2;
  container.scrollTo({ top: target, behavior: smooth && near && !prefersReducedMotion() ? 'smooth' : 'auto' });
}

function startsInView(container: HTMLElement, row: Element): boolean {
  const view = container.getBoundingClientRect();
  const top = row.getBoundingClientRect().top;
  return top >= view.top && top < view.bottom;
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
