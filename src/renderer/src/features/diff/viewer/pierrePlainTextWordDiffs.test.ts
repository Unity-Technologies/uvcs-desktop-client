import { DiffHunksRenderer, type FileDiffMetadata } from '@pierre/diffs';
import type { ElementContent } from 'hast';
import { describe, expect, it } from 'vitest';
import { lineDiff } from './lineDiff';
import { installPierrePlainTextRender } from './pierrePlainTextRender';

const text = (lines: number, changed: (index: number) => boolean) =>
  Array.from({ length: lines }, (_, index) => (changed(index) ? `alpha gamma ${index}\n` : `alpha beta ${index}\n`)).join('');

/** A diff of `lines` lines whose lines at `changed` read "gamma" where they read "beta". */
const diffOf = (lines: number, changed: (index: number) => boolean, fileName = 'file.ts') =>
  lineDiff(text(lines, () => false), text(lines, changed), 'recognizeAll', fileName).meta;

/** The text of each word-level mark (Pierre's `data-diff-span`) in rendered rows, in order. */
function wordMarks(nodes: ElementContent[] | undefined): string[] {
  const marks: string[] = [];
  const visit = (node: ElementContent): void => {
    if (node.type !== 'element') return;
    if (node.properties?.['data-diff-span'] !== undefined) marks.push(textOf(node));
    else node.children.forEach(visit);
  };
  nodes?.forEach(visit);
  return marks;
}

function textOf(node: ElementContent): string {
  if (node.type === 'text') return node.value;
  return node.type === 'element' ? node.children.map(textOf).join('') : '';
}

/** What the viewer's renderer shows of `diff` as plain text (`tokenizeMaxLength` 0, as `syntaxHighlighting` 'off'). */
async function plainTextMarks(diff: FileDiffMetadata, options: { tokenizeMaxLength?: number } = { tokenizeMaxLength: 0 }) {
  installPierrePlainTextRender();
  const renderer = new DiffHunksRenderer({ theme: 'github-light', lineDiffType: 'word', expandUnchanged: true, ...options });
  await renderer.asyncRender(diff);
  const result = renderer.renderDiff(diff)!;
  return { deletions: wordMarks(renderer.renderCodeAST('deletions', result)), additions: wordMarks(renderer.renderCodeAST('additions', result)) };
}

describe('a diff shown as plain text', () => {
  it('marks the words that changed in a plain text diff of more than 1,000 lines', async () => {
    expect(await plainTextMarks(diffOf(10_000, (index) => index === 5_000))).toEqual({ deletions: ['beta'], additions: ['gamma'] });
  });

  it('marks them in a long text file, which is plain text whatever its size', async () => {
    expect(await plainTextMarks(diffOf(3_000, (index) => index === 10, 'notes.txt'), {})).toEqual({ deletions: ['beta'], additions: ['gamma'] });
  });
});
