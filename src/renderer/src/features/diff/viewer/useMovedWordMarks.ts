import { useEffect, useId, type RefObject } from 'react';
import type { DiffSide } from './changeBlocks';
import type { MovedWordMarks } from './movedWordMarks';
import { lineRowSelector, rowTextRange } from './pierreDom';
import { useShadowStyle } from './useShadowStyle';

/**
 * Marks the words changed inside moved code (`movedWordMarks`) in the rows of the diff (`root`, `useDiffShadowRoot`),
 * with the browser's highlights (`CSS.highlights`) in the moved color, stronger than the line's (`--diff-moved-word`).
 * They're drawn over the rows on screen, whatever Pierre renders: its rows come and go as the diff scrolls (it renders
 * the lines in view), is typed into or highlighted, and the marks are drawn again each time (a `MutationObserver`).
 * Marking Pierre's own rows instead (`refreshWordMarks`) was rejected: every render of Pierre's (its worker's colors,
 * a keystroke) would draw its own marks back over them.
 */
export function useMovedWordMarks(containerRef: RefObject<HTMLElement | null>, root: ShadowRoot | null, marks: MovedWordMarks): void {
  const name = highlightName(useId());
  useShadowStyle(containerRef, `::highlight(${name}){background-color:var(--diff-moved-word)}`);

  useEffect(() => {
    const clear = (): void => void CSS.highlights.delete(name);
    if (!root || marks.deletions.size + marks.additions.size === 0) return clear;
    let frame = 0;
    const draw = (): void => {
      frame = 0;
      CSS.highlights.set(name, new Highlight(...markedRanges(root, 'deletions', marks.deletions), ...markedRanges(root, 'additions', marks.additions)));
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
  }, [root, marks, name]);
}

/** The ranges of the marked characters in the rows of one side that are rendered. */
function markedRanges(root: ShadowRoot, side: DiffSide, marks: MovedWordMarks[DiffSide]): Range[] {
  const ranges: Range[] = [];
  for (const [lineNumber, lineMarks] of marks) {
    const row = root.querySelector(lineRowSelector({ side, lineNumber }));
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
  return `moved-words-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}
