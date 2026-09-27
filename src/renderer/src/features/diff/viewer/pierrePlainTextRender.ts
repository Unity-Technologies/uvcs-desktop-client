import { DiffHunksRenderer, type FileDiffMetadata } from '@pierre/diffs';

/**
 * Makes Pierre (1.5.1) render a diff shown as plain text once instead of at every render. Its renderer on the main
 * thread (an editable diff, or a read-only one past what the workers highlight) renders the whole text again whenever
 * it renders (`renderDiff` takes the `forcePlainText` branch every time), so a virtualized diff rendered all its lines
 * for every few rows scrolled into view: a quarter of a second a step for 100,000 lines. The result is kept as Pierre
 * keeps a highlighted one, and rendered anew when the diff or its options change or an edit touched it (`isDirty`).
 * `pierrePlainTextRender.test.ts` fails when an update moves what this reaches.
 */
export function installPierrePlainTextRender(): void {
  if (installed) return;
  installed = true;
  const renderer = DiffHunksRenderer.prototype as unknown as PlainTextRenderer;
  const renderDiffWithHighlighter = renderer.renderDiffWithHighlighter;
  renderer.renderDiffWithHighlighter = function (this: PlainTextRenderer, diff, highlighter, forcePlainText = false) {
    const cache = this.renderCache;
    const kept = forcePlainText && cache?.result != null && !cache.highlighted && cache.isDirty !== true && cache.renderRange === undefined;
    if (kept && !this.getRenderOptions(diff).forceHighlight) return { result: cache.result, options: cache.options };
    return renderDiffWithHighlighter.call(this, diff, highlighter, forcePlainText);
  };
}

let installed = false;

/** The renderer's members this reaches: all private. */
interface PlainTextRenderer {
  renderCache: { diff: FileDiffMetadata; highlighted: boolean; isDirty?: boolean; options: unknown; result?: unknown; renderRange?: unknown } | undefined;
  getRenderOptions(diff: FileDiffMetadata): { options: unknown; forceHighlight: boolean };
  renderDiffWithHighlighter(diff: FileDiffMetadata, highlighter: unknown, forcePlainText?: boolean): { result: unknown; options: unknown };
}
