import { useEffect, useId, type RefObject } from 'react';
import type { ChangedLine, DiffSide } from './changeBlocks';
import { lineRowSelector, rowTextRange } from './pierreDom';
import { useShadowStyle } from './useShadowStyle';
import type { WordMarksByLine } from './wordMarkRows';

/** Each side's marks' background: a CSS color, read in the diff's shadow root (Pierre's variables resolve there). */
export interface WordMarkColors {
  deletions: string;
  additions: string;
}

/** Moved code's: both sides in the moved color, stronger than the line's (`--diff-moved-word`). */
export const MOVED_WORD_COLORS: WordMarkColors = { deletions: 'var(--diff-moved-word)', additions: 'var(--diff-moved-word)' };

/**
 * Marks words of a diff's lines where Pierre's own pairing would mark the wrong ones (moved code, `movedWordMarks`; a
 * stacked suggestion, `stackedWordMarks`) in the rows of the diff (`root`, `useDiffShadowRoot`), with the browser's
 * highlights (`CSS.highlights`) in each side's color (`colors`). They're drawn over the rows on screen, whatever Pierre
 * renders: its rows come and go as the diff scrolls (it renders the lines in view), is typed into or highlighted, and
 * the marks are drawn again each time (a `MutationObserver`).
 * Marking Pierre's own rows instead (`refreshWordMarks`) was rejected: every render of Pierre's (its worker's colors,
 * a keystroke) would draw its own marks back over them.
 * Marks are on changed lines (`lineRowSelector`) unless `rowSelector` finds others too (a search's matches,
 * `sideLineRowSelector`).
 */
export function useWordMarks(
  containerRef: RefObject<HTMLElement | null>,
  root: ShadowRoot | null,
  marks: WordMarksByLine,
  colors: WordMarkColors,
  rowSelector: (line: ChangedLine) => string = lineRowSelector,
): void {
  const name = highlightName(useId());
  useShadowStyle(containerRef, `::highlight(${name}-deletions){background-color:${colors.deletions}}::highlight(${name}-additions){background-color:${colors.additions}}`);

  useEffect(() => {
    const clear = (): void => {
      CSS.highlights.delete(`${name}-deletions`);
      CSS.highlights.delete(`${name}-additions`);
    };
    if (!root || marks.deletions.size + marks.additions.size === 0) return clear;
    let frame = 0;
    const draw = (): void => {
      frame = 0;
      CSS.highlights.set(`${name}-deletions`, new Highlight(...markedRanges(root, rowSelector, 'deletions', marks.deletions)));
      CSS.highlights.set(`${name}-additions`, new Highlight(...markedRanges(root, rowSelector, 'additions', marks.additions)));
    };
    const schedule = (): void => {
      frame ||= requestAnimationFrame(draw);
    };
    const mutations = new MutationObserver(schedule);
    mutations.observe(root, { childList: true, subtree: true, characterData: true });
    draw();
    return () => {
      cancelAnimationFrame(frame);
      mutations.disconnect();
      clear();
    };
  }, [root, marks, name, rowSelector]);
}

/** The ranges of the marked characters in the rows of one side that are rendered. */
function markedRanges(root: ShadowRoot, rowSelector: (line: ChangedLine) => string, side: DiffSide, marks: WordMarksByLine[DiffSide]): Range[] {
  const ranges: Range[] = [];
  for (const [lineNumber, lineMarks] of marks) {
    const row = root.querySelector(rowSelector({ side, lineNumber }));
    if (!row) continue;
    for (const { start, end } of lineMarks) {
      const range = rowTextRange(row, start, end);
      if (range) ranges.push(range);
    }
  }
  return ranges;
}

/** Highlights are named for the whole page: each diff's own, from its React id, as a CSS identifier. */
function highlightName(id: string): string {
  return `word-marks-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}
