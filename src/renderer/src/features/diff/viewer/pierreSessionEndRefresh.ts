import { DiffHunksRenderer, type FileDiffMetadata } from '@pierre/diffs';

/**
 * Makes Pierre (1.5.1) refresh a diff's colors after its edit session ends only if the diff is still shown, once the
 * app has moved on. When the editor detaches (the diff unmounts as another file is selected, or the shown diff is
 * replaced), Pierre settles the session's hunks (`finalizeEditSessionHunks`) and highlights the whole diff again at
 * once (`refreshHighlightedResult`): on the main thread for a diff without a `cacheKey`, as ours are, 1.6 s for
 * 2 x 190 KB of TypeScript, for a diff about to be thrown away. This runs it a task later, and not at all once the
 * renderer let the diff go (`cleanUp` clears `diff`) or shows another. Upstream, `refreshHighlightedResult` would
 * skip a renderer being cleaned up, or highlight in its worker pool without a `cacheKey`.
 * `pierreSessionEndRefresh.test.ts` fails when an update moves what this reaches.
 */
export function installPierreSessionEndRefresh(): void {
  if (installed) return;
  installed = true;
  const renderer = DiffHunksRenderer.prototype as unknown as RefreshingRenderer;
  const refreshHighlightedResult = renderer.refreshHighlightedResult;
  renderer.refreshHighlightedResult = function (this: RefreshingRenderer) {
    const diff = this.diff;
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        if (diff === undefined || this.diff !== diff) return resolve();
        refreshHighlightedResult.call(this).then(resolve, resolve);
      }, 0);
    });
  };
}

let installed = false;

/** The renderer's members this reaches: `refreshHighlightedResult` is public, `diff` private. */
interface RefreshingRenderer {
  diff: FileDiffMetadata | undefined;
  refreshHighlightedResult(): Promise<void>;
}
