import { DiffHunksRenderer, getSharedHighlighter, renderDiffWithHighlighter, type FileDiffMetadata } from '@pierre/diffs';
import { describe, expect, it } from 'vitest';
import { lineDiff } from './lineDiff';
import { installPierrePlainTextRender } from './pierrePlainTextRender';
import { MAX_WORD_DIFFED_LINE_PAIRS } from './changedLinePairs';
import { installPierrePlainTextWordDiffs } from './pierrePlainTextWordDiffs';
import { renderedWordMarks, wordMarksIn, type RenderedNode } from './renderedWordMarks';

const text = (lines: number, changed: (index: number) => boolean) =>
  Array.from({ length: lines }, (_, index) => (changed(index) ? `alpha gamma ${index}\n` : `alpha beta ${index}\n`)).join('');

/** A diff of `lines` lines whose lines at `changed` read "gamma" where they read "beta". */
const diffOf = (lines: number, changed: (index: number) => boolean, fileName = 'file.ts') =>
  lineDiff(text(lines, () => false), text(lines, changed), 'recognizeAll', fileName).meta;

/** What the viewer's renderer shows of `diff` as plain text (`tokenizeMaxLength` 0, as `syntaxHighlighting` 'off'). */
async function plainTextMarks(diff: FileDiffMetadata, options: { tokenizeMaxLength?: number } = { tokenizeMaxLength: 0 }) {
  installPierrePlainTextRender();
  installPierrePlainTextWordDiffs();
  const renderer = new DiffHunksRenderer({ theme: 'github-light', lineDiffType: 'word', expandUnchanged: true, ...options });
  await renderer.asyncRender(diff);
  return renderedWordMarks(renderer, renderer.renderDiff(diff)!);
}

describe('installPierrePlainTextWordDiffs', () => {
  it('marks the words that changed in a plain text diff of more than 1,000 lines', async () => {
    expect(await plainTextMarks(diffOf(10_000, (index) => index === 5_000))).toEqual({ deletions: ['beta'], additions: ['gamma'] });
  });

  it('marks them in a long text file, which is plain text whatever its size', async () => {
    expect(await plainTextMarks(diffOf(3_000, (index) => index === 10, 'notes.txt'), {})).toEqual({ deletions: ['beta'], additions: ['gamma'] });
  });

  it('marks no words once more lines changed than are worth it, as Pierre does', async () => {
    const marks = await plainTextMarks(diffOf(3_000, (index) => index <= MAX_WORD_DIFFED_LINE_PAIRS));
    expect(marks).toEqual({ deletions: [], additions: [] });
  });

  it('marks every pair of changed lines up to the bound', async () => {
    const marks = await plainTextMarks(diffOf(3_000, (index) => index < MAX_WORD_DIFFED_LINE_PAIRS));
    expect(marks.additions).toHaveLength(MAX_WORD_DIFFED_LINE_PAIRS);
  });

  it('leaves the diff as it was after rendering it', async () => {
    const diff = diffOf(3_000, (index) => index === 10);
    const before = structuredClone(diff);
    await plainTextMarks(diff);
    expect(diff).toEqual(before);
  });
});

describe("Pierre's plain text render in the workers", () => {
  // `WorkerPoolManager.getPlainDiffAST` shows a read-only diff as plain text until the workers highlight it. It renders
  // only the rows in view (the diff is virtualized), and Pierre keeps the word diffs of such a render: no patch needed.
  it('keeps the word diffs of the rows in view', async () => {
    const diff = diffOf(10_000, (index) => index === 5_000);
    const highlighter = await getSharedHighlighter({ themes: ['github-light'], langs: ['text'], preferredHighlighter: 'shiki-js' });
    const options = { theme: 'github-light', useTokenTransformer: false, tokenizeMaxLineLength: 1_000, lineDiffType: 'word', maxLineDiffLength: 1_000 } as const;
    const { code } = renderDiffWithHighlighter(diff, highlighter, options, { forcePlainText: true, startingLine: 4_990, totalLines: 20, expandedHunks: true });
    expect(wordMarksIn(code.additionLines.filter(Boolean) as RenderedNode[])).toEqual(['gamma']);
  });
});
