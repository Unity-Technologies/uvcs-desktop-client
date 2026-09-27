import { DiffHunksRenderer } from '@pierre/diffs';
import { describe, expect, it } from 'vitest';
import { lineDiff } from './lineDiff';
import { installPierrePlainTextRender } from './pierrePlainTextRender';

const text = (lines: number, changed: (index: number) => boolean) =>
  Array.from({ length: lines }, (_, index) => (changed(index) ? `changed ${index}\n` : `line ${index}\n`)).join('');

/** Pierre's renderer as the viewer has it for a diff shown as plain text (`tokenizeMaxLength` 0), rendered once. */
async function plainTextRenderer() {
  installPierrePlainTextRender();
  const diff = lineDiff(text(3_000, () => false), text(3_000, (index) => index % 10 === 0), 'recognizeAll', 'file.ts').meta;
  const renderer = new DiffHunksRenderer({ theme: 'github-light', tokenizeMaxLength: 0, expandUnchanged: true });
  await renderer.asyncRender(diff);
  renderer.renderDiff(diff);
  const internals = renderer as unknown as { renderCache: { result: unknown } };
  return { renderer, diff, result: () => internals.renderCache.result };
}

describe('installPierrePlainTextRender', () => {
  it('renders a plain text diff once for all the rows scrolled into view', async () => {
    const { renderer, diff, result } = await plainTextRenderer();
    const rendered = result();
    expect(rendered).toBeDefined();
    for (const startingLine of [0, 500, 1_200, 2_900]) {
      const rows = renderer.renderDiff(diff, { startingLine, totalLines: 50, bufferBefore: 0, bufferAfter: 0 });
      expect(rows).toBeDefined();
      expect(result()).toBe(rendered);
    }
  });

  it('shows the rows asked for, the same as rendering them anew', async () => {
    const { renderer, diff } = await plainTextRenderer();
    const range = { startingLine: 1_000, totalLines: 20, bufferBefore: 0, bufferAfter: 0 };
    const kept = renderer.renderCodeAST('additions', renderer.renderDiff(diff, range)!);
    const fresh = new DiffHunksRenderer({ theme: 'github-light', tokenizeMaxLength: 0, expandUnchanged: true });
    await fresh.asyncRender(diff);
    expect(kept).toEqual(fresh.renderCodeAST('additions', fresh.renderDiff(diff, range)!));
  });

  it('renders anew for another diff, other options, or once an edit touched the rows', async () => {
    const { renderer, diff, result } = await plainTextRenderer();
    const other = lineDiff(text(100, () => false), text(100, (index) => index === 5), 'recognizeAll', 'file.ts').meta;
    const first = result();
    renderer.renderDiff(other);
    expect(result()).not.toBe(first);
    const second = result();
    renderer.setOptions({ theme: 'github-dark', tokenizeMaxLength: 0, expandUnchanged: true });
    await renderer.asyncRender(other);
    renderer.renderDiff(other);
    expect(result()).not.toBe(second);
    const third = result();
    renderer.updateRenderCache(new Map([[5, [[0, '', 'typed']]]]), 'dark');
    renderer.renderDiff(other);
    expect(result()).not.toBe(third);
    void diff;
  });
});
