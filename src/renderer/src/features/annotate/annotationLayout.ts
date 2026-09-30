import type { AnnotationBlock } from './annotationBlocks';
import type { RowRange } from './visibleRows';

/**
 * Pierre's line height and top padding, pinned so the gutter and the rules lay out their rows with the code's geometry.
 * The gutter reads the padding from the shared `--diffs-gap-block` variable.
 */
export const ANNOTATION_LINE_HEIGHT = 20;
export const CODE_PADDING_TOP = 8;

/** Lines of context kept above a block brought into view. */
const CONTEXT_LINES = 3;

/** The line at the top of a view scrolled to `scrollTop` (0-based). */
export function lineAtTop(scrollTop: number): number {
  return Math.floor(Math.max(0, scrollTop - CODE_PADDING_TOP) / ANNOTATION_LINE_HEIGHT);
}

/**
 * Where to scroll so `block` shows: null while its first line is in view, else a few lines from the top, with what
 * came before it for context.
 */
export function scrollTopRevealing(block: AnnotationBlock, view: { scrollTop: number; height: number }): number | null {
  const top = CODE_PADDING_TOP + block.start * ANNOTATION_LINE_HEIGHT;
  const bottom = top + ANNOTATION_LINE_HEIGHT;
  if (top >= view.scrollTop && bottom <= view.scrollTop + view.height) return null;
  return top - CONTEXT_LINES * ANNOTATION_LINE_HEIGHT;
}

/** The lines above and below the blocks rendered (`shown`), which the gutter keeps as empty room. */
export function roomAroundShown(blocks: readonly AnnotationBlock[], shown: RowRange): { above: number; below: number } {
  const lineCount = blocks.at(-1)?.end ?? 0;
  return { above: blocks[shown.first]?.start ?? 0, below: lineCount - (blocks[shown.end - 1]?.end ?? 0) };
}
