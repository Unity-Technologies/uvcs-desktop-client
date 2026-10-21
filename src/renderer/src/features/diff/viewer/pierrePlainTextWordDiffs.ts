import { DiffHunksRenderer, type FileDiffMetadata } from '@pierre/diffs';
import { MAX_WORD_DIFFED_LINE_PAIRS, wordDiffedLinePairs } from './changedLinePairs';

/**
 * Makes Pierre (1.6.0) mark the changed words of a diff shown as plain text, whatever its length. Its renderer on the
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
  renderer.renderDiffWithHighlighter = function (this: PlainTextRenderer, diff, highlighter, forcePlainText = false, ...rest) {
    const render = () => renderDiffWithHighlighter.call(this, diff, highlighter, forcePlainText, ...rest);
    if (!forcePlainText || wordDiffedLinePairs(diff) > MAX_WORD_DIFFED_LINE_PAIRS) return render();
    return withLineCountsHidden(diff, render);
  };
}

let installed = false;

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
  /** `rest` is what Pierre passes past the arguments this reads (1.6's `lazyLineAST`), handed on as it is. */
  renderDiffWithHighlighter(diff: FileDiffMetadata, highlighter: unknown, forcePlainText?: boolean, ...rest: unknown[]): unknown;
}
