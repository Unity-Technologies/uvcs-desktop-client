import type { ChangedLine, DiffSide } from './changeBlocks';
import { lineRowSelector, numberCellSelector } from './pierreDom';

/** Lines of a diff to call out while discarding changes. */
export interface LineMarks {
  /** What a discard is about to do: the added lines that would go, the removed lines that would come back. */
  preview?: ChangedLine[];
  /** Lines being discarded, fading out before the diff updates. */
  leaving?: ChangedLine[];
  /** Lines just brought back (1-based, in the modified file), briefly lit. */
  restoredAt?: number[];
  /** The picked lines are all on this side: side by side, the other side's rows shouldn't look picked. */
  pickedSide?: DiffSide;
}

/**
 * CSS for the marks, to go inside the diff's shadow root. It targets the rows `@pierre/diffs` renders (a gutter cell and
 * a content row per line, with its type and number), the same in the split and unified layouts.
 */
export function lineMarksCss({ preview = [], leaving = [], restoredAt = [], pickedSide }: LineMarks): string {
  const rules: string[] = [];
  // Mixing the picked color in at 100% of the line's own leaves the line as it was.
  const otherSide = pickedSide === 'deletions' ? 'additions' : 'deletions';
  if (pickedSide) rules.push(`[data-${otherSide}] [data-selected-line][data-selected-line]{--mix-selection-light:100%;--mix-selection-dark:100%}`);
  // Motion only for whoever wants it; the marks themselves stay.
  const animated: string[] = [];
  const going = preview.filter((line) => line.side === 'additions');
  const coming = preview.filter((line) => line.side === 'deletions');
  if (going.length > 0) rules.push(`${content(going)}{text-decoration:line-through;opacity:.45}`);
  if (coming.length > 0) rules.push(`${[content(coming), gutter(coming)].join(',')}{box-shadow:inset 3px 0 0 var(--accent),inset 0 0 0 100vmax var(--accent-soft)}`);
  if (leaving.length > 0) animated.push(`${[content(leaving), gutter(leaving)].join(',')}{animation:discard-leave var(--duration-fast) ease-in forwards}`);
  if (restoredAt.length > 0) {
    const rows = restoredAt.flatMap((lineNumber) => [`[data-line="${lineNumber}"]`, `[data-column-number="${lineNumber}"]`]).join(',');
    animated.push(`:is([data-additions],[data-unified]) :is(${rows}):is([data-line-type="context"],[data-line-type="context-expanded"]){animation:discard-restored 900ms var(--ease-out)}`);
  }
  if (animated.length > 0) {
    rules.push(
      `@media (prefers-reduced-motion:no-preference){${animated.join('')}}`,
      '@keyframes discard-leave{to{opacity:0}}',
      '@keyframes discard-restored{from{background-color:var(--bg-selected-strong)}}',
    );
  }
  return rules.join('\n');
}

/** How many of a change's lines light up when it's moved to: enough to see where it starts. */
const FLASHED_LINES = 200;

/**
 * CSS lighting up, for a moment, the change the diff's navigation moved to (`round` counts the moves, so moving to the
 * same change again lights it again). With reduced motion it's lit without fading, as long as the viewer keeps it.
 */
export function changeFlashCss(lines: ChangedLine[], round: number): string {
  if (lines.length === 0) return '';
  const shown = lines.slice(0, FLASHED_LINES);
  const rows = [content(shown), gutter(shown)].join(',');
  const name = `change-flash-${round % 2}`;
  return [
    `@media (prefers-reduced-motion:no-preference){${rows}{animation:${name} 1.2s var(--ease-out) forwards}}`,
    `@media (prefers-reduced-motion:reduce){${rows}{box-shadow:inset 0 0 0 100vmax var(--bg-selected-strong)}}`,
    `@keyframes ${name}{from{box-shadow:inset 0 0 0 100vmax var(--bg-selected-strong)}to{box-shadow:inset 0 0 0 100vmax transparent}}`,
  ].join('\n');
}

const content = (lines: ChangedLine[]): string => lines.map(lineRowSelector).join(',');
const gutter = (lines: ChangedLine[]): string => lines.map(numberCellSelector).join(',');
