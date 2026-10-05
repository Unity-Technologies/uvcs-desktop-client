import { useEffect, useId, type RefObject } from 'react';
import type { DiffSide } from './changeBlocks';
import type { MovedWordMarks } from './movedWordMarks';
import { lineRowSelector, pierreShadowRoot, rowTextRange } from './pierreDom';
import { useShadowStyle } from './useShadowStyle';

/**
 * Marks the words changed inside moved code (`movedWordMarks`) in the diff's rows, with the browser's highlights
 * (`CSS.highlights`) in Pierre's own colors for marked words. They're drawn over the rows on screen, whatever Pierre
 * renders: its rows come and go as the diff scrolls (it renders the lines in view), is typed into or highlighted, and
 * the marks are drawn again each time (a `MutationObserver`). Marking Pierre's own rows instead (`refreshWordMarks`)
 * was rejected: every render of Pierre's (its worker's colors, a keystroke) would draw its own marks back over them.
 */
export function useMovedWordMarks(containerRef: RefObject<HTMLElement | null>, marks: MovedWordMarks): void {
  const names = highlightNames(useId());
  useShadowStyle(
    containerRef,
    `::highlight(${names.deletions}){background-color:var(--diffs-bg-deletion-emphasis)}\n::highlight(${names.additions}){background-color:var(--diffs-bg-addition-emphasis)}`,
  );

  useEffect(() => {
    const root = pierreShadowRoot(containerRef.current);
    const clear = (): void => {
      CSS.highlights.delete(names.deletions);
      CSS.highlights.delete(names.additions);
    };
    if (!root || marks.deletions.size + marks.additions.size === 0) return clear;
    let frame = 0;
    const draw = (): void => {
      frame = 0;
      CSS.highlights.set(names.deletions, new Highlight(...markedRanges(root, 'deletions', marks.deletions)));
      CSS.highlights.set(names.additions, new Highlight(...markedRanges(root, 'additions', marks.additions)));
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
  }, [containerRef, marks, names.deletions, names.additions]);
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
function highlightNames(id: string): Record<DiffSide, string> {
  const own = id.replace(/[^a-zA-Z0-9_-]/g, '');
  return { deletions: `moved-words-${own}-deletions`, additions: `moved-words-${own}-additions` };
}
