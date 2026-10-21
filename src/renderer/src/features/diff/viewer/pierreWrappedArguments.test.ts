import { DiffHunksRenderer } from '@pierre/diffs';
import { describe, expect, it, vi } from 'vitest';
import { installPierreLineComparison } from './pierreLineComparison';
import { installPierrePlainTextRender } from './pierrePlainTextRender';
import { installPierrePlainTextWordDiffs } from './pierrePlainTextWordDiffs';

/** The renderer's methods the app wraps, as Pierre calls them. */
interface WrappedRenderer {
  renderDiffWithHighlighter(...args: unknown[]): unknown;
  updateRenderCache(...args: unknown[]): boolean;
}

// Pierre adds arguments to the methods the app wraps (1.6 gave `renderDiffWithHighlighter` its `lazyLineAST`, and
// `updateRenderCache` the editor's `changedDocumentLines` and `documentLineCount`): a wrapper that names the ones it knew
// hands Pierre's own method undefined for the rest, and Pierre quietly does without them. Pierre's methods are spied on
// before the app wraps them, so each wrapper calls the spy.
describe("Pierre's renderer methods the app wraps", () => {
  const renderer = DiffHunksRenderer.prototype as unknown as WrappedRenderer;
  const renderDiffWithHighlighter = vi.spyOn(renderer, 'renderDiffWithHighlighter').mockReturnValue({ result: undefined, options: undefined });
  const updateRenderCache = vi.spyOn(renderer, 'updateRenderCache').mockReturnValue(false);
  installPierrePlainTextRender();
  installPierrePlainTextWordDiffs();
  installPierreLineComparison();

  it('hand renderDiffWithHighlighter every argument Pierre passes', () => {
    const diff = { unifiedLineCount: 0, splitLineCount: 0 };
    renderer.renderDiffWithHighlighter.call({}, diff, 'highlighter', false, true);
    expect(renderDiffWithHighlighter.mock.calls).toEqual([[diff, 'highlighter', false, true]]);
  });

  it('hand updateRenderCache every argument Pierre passes', () => {
    const changedDocumentLines = new Map([[3, 'typed\n']]);
    renderer.updateRenderCache.call({ options: {}, editSessionActive: false }, new Map(), 'light', false, changedDocumentLines, 10);
    expect(updateRenderCache.mock.calls).toEqual([[new Map(), 'light', false, changedDocumentLines, 10]]);
  });
});
