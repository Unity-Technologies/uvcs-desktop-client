import { DiffHunksRenderer } from '@pierre/diffs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { installPierreLineComparison } from './pierreLineComparison';
import { installPierrePlainTextRender } from './pierrePlainTextRender';
import { installPierrePlainTextWordDiffs } from './pierrePlainTextWordDiffs';
import { installPierreSessionEndRefresh } from './pierreSessionEndRefresh';

type Method = 'renderDiffWithHighlighter' | 'updateRenderCache' | 'applySessionDocumentChange' | 'refreshHighlightedResult';

/** The renderer's methods the app wraps, as Pierre calls them. */
type WrappedRenderer = Record<Method, (...args: unknown[]) => unknown>;

const renderer = DiffHunksRenderer.prototype as unknown as WrappedRenderer;
const spies = new Map<Method, ReturnType<typeof vi.fn>>();

// Pierre adds arguments to the methods the app wraps (1.6 gave `renderDiffWithHighlighter` its `lazyLineAST`, and
// `updateRenderCache` the editor's `changedDocumentLines` and `documentLineCount`): a wrapper that names the ones it knew
// hands Pierre's own method undefined for the rest, and Pierre quietly does without them. Pierre's methods are spied on
// before the app wraps them, so each wrapper calls the spy. The spies stay: the wrappers hold them, and this file's
// module state (the prototype, the installers' `installed` flags) is its own.
beforeAll(() => {
  const returns: Record<Method, unknown> = {
    renderDiffWithHighlighter: { result: undefined, options: undefined },
    updateRenderCache: false,
    applySessionDocumentChange: undefined,
    refreshHighlightedResult: Promise.resolve(),
  };
  for (const method of Object.keys(returns) as Method[]) spies.set(method, vi.spyOn(renderer, method).mockReturnValue(returns[method]));
  installPierrePlainTextRender();
  installPierrePlainTextWordDiffs();
  installPierreLineComparison();
  installPierreSessionEndRefresh();
});

const diff = { unifiedLineCount: 0, splitLineCount: 0, additionLines: [], deletionLines: [] };
// Each method as Pierre calls it, with one argument more than it takes today, and a renderer as the wrapper reads it.
const CALLS: { method: Method; self: object; args: unknown[] }[] = [
  { method: 'renderDiffWithHighlighter', self: {}, args: [diff, 'highlighter', false, true, 'next'] },
  { method: 'updateRenderCache', self: { options: {}, editSessionActive: false }, args: [new Map(), 'light', false, new Map([[3, 'typed\n']]), 10, 'next'] },
  { method: 'applySessionDocumentChange', self: { options: {} }, args: [diff, [], 'next'] },
  { method: 'refreshHighlightedResult', self: { diff }, args: ['next'] },
];

describe("Pierre's renderer methods the app wraps", () => {
  it.each(CALLS)('hand $method every argument Pierre passes', async ({ method, self, args }) => {
    vi.useFakeTimers();
    try {
      const done = renderer[method].call(self, ...args);
      // `refreshHighlightedResult` runs a task later (`installPierreSessionEndRefresh`).
      await vi.runAllTimersAsync();
      await done;
    } finally {
      vi.useRealTimers();
    }
    expect(spies.get(method)?.mock.calls.at(-1)).toEqual(args);
  });
});
