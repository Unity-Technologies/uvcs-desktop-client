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

/**
 * Where the conflicts view stands for stepping through them (`useConflictView`): just before a conflict resolved
 * there, so the next move goes on to the one that took its place (the screen can't tell: with every conflict in view,
 * none starts above its top), until the view moves; else where the screen says.
 */
export class ConflictPlace {
  private resolved: number | null = null;
  private lastRead = 0;

  /** A conflict was resolved in the view, by its index among those that were left. */
  resolvedAt(index: number): void {
    this.resolved = index;
  }

  /** The view moved (to a conflict, or scrolled by the user): where it stands is on screen again. */
  moved(): void {
    this.resolved = null;
  }

  /** How many conflicts start above where the view stands, from `onScreen` unless one was just resolved. */
  above(onScreen: () => number): number {
    if (this.resolved !== null) return this.resolved;
    this.lastRead = onScreen();
    return this.lastRead;
  }

  /** The same without reading the screen, while the conflicts change: where it last stood. */
  aboveAfterChange(): number {
    return this.resolved ?? this.lastRead;
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
