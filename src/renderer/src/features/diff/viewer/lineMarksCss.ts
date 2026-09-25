import type { ChangedLine } from './changeBlocks';

/** Lines of a diff to call out while discarding changes. */
export interface LineMarks {
  /** What a discard is about to do: the added lines that would go, the removed lines that would come back. */
  preview?: ChangedLine[];
  /** Lines being discarded, fading out before the diff updates. */
  leaving?: ChangedLine[];
  /** Lines just brought back (1-based, in the modified file), briefly lit. */
  restoredAt?: number[];
}

/**
 * CSS for the marks, to go inside the diff's shadow root. It targets the rows `@pierre/diffs` renders (a gutter cell and
 * a content row per line, with its type and number), the same in the split and unified layouts.
 */
export function lineMarksCss({ preview = [], leaving = [], restoredAt = [] }: LineMarks): string {
  const rules: string[] = [];
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

const lineType = ({ side }: ChangedLine): string => (side === 'deletions' ? 'change-deletion' : 'change-addition');
const content = (lines: ChangedLine[]): string => lines.map((line) => `[data-line-type="${lineType(line)}"][data-line="${line.lineNumber}"]`).join(',');
const gutter = (lines: ChangedLine[]): string => lines.map((line) => `[data-line-type="${lineType(line)}"][data-column-number="${line.lineNumber}"]`).join(',');
