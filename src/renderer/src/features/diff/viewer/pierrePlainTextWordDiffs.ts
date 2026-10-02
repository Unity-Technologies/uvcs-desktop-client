import { DiffHunksRenderer, type FileDiffMetadata } from '@pierre/diffs';

/**
 * How many pairs of changed lines a diff shown as plain text marks the changed words of. Each pair is one word diff
 * of two lines (Pierre's `computeLineDiffDecorations`, lines past 1,000 characters skipped): measured at 0.004 ms for
 * a line with one word changed, 0.07 ms for an 80-character line rewritten, 7 ms for a 1,000-character one. That's
 * at most 70 ms for a thousand ordinary lines rewritten, and as much as Pierre already does for any diff of 1,000
 * lines; past it, a diff shows its changed lines without marking their words, as Pierre does.
 */
export const MAX_WORD_DIFFED_LINE_PAIRS = 1_000;

/**
 * Makes Pierre (1.5.1) mark the changed words of a diff shown as plain text, whatever its length. Its renderer on the
 * main thread (`renderDiffWithHighlighter` with `forcePlainText`: a "Large file", or a text file of any size) marks
 * none once the diff has more than 1,000 lines (its `unifiedLineCount` or `splitLineCount`), so a 10,000-line file
 * with one line changed showed no word marks. But words are diffed only for pairs of changed lines, whatever the
 * length of the file, so this bounds them by those pairs instead (`MAX_WORD_DIFFED_LINE_PAIRS`). Pierre reads the line
 * counts only for that rule: within the render they read 0, and the diff gets them back right after. The diff stays
 * the same object, since Pierre (and `installPierrePlainTextRender`) tell diffs apart by identity.
 * The workers' plain text (`WorkerPoolManager.getPlainDiffAST`) renders only the rows in view, which Pierre marks
 * already. `pierrePlainTextWordDiffs.test.ts` fails when an update moves what this reaches.
 */
export function installPierrePlainTextWordDiffs(): void {
  if (installed) return;
  installed = true;
  const renderer = DiffHunksRenderer.prototype as unknown as PlainTextRenderer;
  const renderDiffWithHighlighter = renderer.renderDiffWithHighlighter;
  renderer.renderDiffWithHighlighter = function (this: PlainTextRenderer, diff, highlighter, forcePlainText = false) {
    const render = () => renderDiffWithHighlighter.call(this, diff, highlighter, forcePlainText);
    if (!forcePlainText || wordDiffedLinePairs(diff) > MAX_WORD_DIFFED_LINE_PAIRS) return render();
    return withLineCountsHidden(diff, render);
  };
}

let installed = false;

/** How many pairs of lines the diff's changes replace: the line diffs a render with word marks computes. */
export function wordDiffedLinePairs(diff: FileDiffMetadata): number {
  let pairs = 0;
  for (const hunk of diff.hunks) {
    for (const part of hunk.hunkContent) {
      if (part.type === 'change') pairs += Math.min(part.additions, part.deletions);
    }
  }
  return pairs;
}

function withLineCountsHidden<T>(diff: FileDiffMetadata, render: () => T): T {
  const { unifiedLineCount, splitLineCount } = diff;
  diff.unifiedLineCount = 0;
  diff.splitLineCount = 0;
  try {
    return render();
  } finally {
    diff.unifiedLineCount = unifiedLineCount;
    diff.splitLineCount = splitLineCount;
  }
}

/** The renderer's member this reaches: private. */
interface PlainTextRenderer {
  renderDiffWithHighlighter(diff: FileDiffMetadata, highlighter: unknown, forcePlainText?: boolean): unknown;
}
