import { FLASHED_LINES } from '../../diff/viewer/lineMarksCss';

/**
 * How many conflicts start above the top of the view (`viewTop`), from their header rows (`rows`, in order) and where
 * each starts (`topOf`, read only up to the first in view): where the first move through them goes from. One starting
 * at the very top is in view.
 */
export function conflictsAbove<Row>(rows: readonly Row[], topOf: (row: Row) => number, viewTop: number): number {
  const firstInView = rows.findIndex((row) => topOf(row) >= viewTop);
  return firstInView === -1 ? rows.length : firstInView;
}

/** Where the conflicts' scrolling surface is scrolled to (`top`), and the most it can be (`max`). */
export interface SurfaceScroll {
  top: number;
  max: number;
}

/**
 * How far the surface may scroll, in pixels (about three rows), before the view counts as moved: a trackpad's momentum
 * or a nudge doesn't.
 */
const NUDGE_PX = 60;

/** A conflict resolved in the view: its index among those left, how many there were, and where the surface stood. */
interface Resolved {
  index: number;
  count: number;
  scrollTop: number;
}

/**
 * Where the conflicts view stands for stepping through them (`useConflictView`): just before a conflict resolved
 * there, so the next move goes on to the one that took its place (the screen can't tell: with every conflict in view,
 * none starts above its top), until the view really moves or the conflicts change otherwise; else where the screen
 * says.
 */
export class ConflictPlace {
  private resolved: Resolved | null = null;
  private lastRead = 0;

  /** A conflict was resolved in the view: its index among the `count` that were left, with the surface at `scroll`. */
  resolvedAt(index: number, count: number, scroll: SurfaceScroll): void {
    this.resolved = { index, count, scrollTop: scroll.top };
  }

  /** The view moved to a conflict: where it stands is on screen again. */
  moved(): void {
    this.resolved = null;
  }

  /**
   * How many conflicts start above where the view stands: just before the one resolved while the surface stays where it
   * was (give or take `NUDGE_PX`, or pulled back by the shorter text at the end of the file), else from `onScreen`.
   */
  above(onScreen: () => number, scroll: SurfaceScroll): number {
    if (this.resolved && this.staysAt(scroll)) return this.resolved.index;
    this.resolved = null;
    this.lastRead = onScreen();
    return this.lastRead;
  }

  /**
   * The same without reading the screen, as the conflicts change to `count`: just before the one resolved when that
   * is the change (one fewer), however often asked; any other change (started over, saved by a merge tool) forgets it.
   */
  aboveAfterChange(count: number): number {
    if (this.resolved && count === this.resolved.count - 1) return this.resolved.index;
    this.resolved = null;
    return this.lastRead;
  }

  private staysAt(scroll: SurfaceScroll): boolean {
    const resolved = this.resolved!;
    // The text lost the conflict's rows: at the end of the file, the surface can't scroll as far as it stood.
    if (scroll.top < resolved.scrollTop && scroll.top >= scroll.max - 1) resolved.scrollTop = scroll.top;
    return Math.abs(scroll.top - resolved.scrollTop) <= NUDGE_PX;
  }
}

/**
 * Selects a conflict's lines, their text and their numbers, by Pierre's `data-line-index` (unique in the file, unlike
 * a line number, which both sides of a conflict share): what lights up when the conflict is moved to (`flashCss`), its
 * first lines only, enough to see where it starts (`FLASHED_LINES`, as a diff's change).
 */
export function conflictLinesSelector(lineIndexes: readonly string[]): string {
  return lineIndexes.slice(0, FLASHED_LINES).map((index) => `[data-line-index="${index}"]`).join(',');
}
