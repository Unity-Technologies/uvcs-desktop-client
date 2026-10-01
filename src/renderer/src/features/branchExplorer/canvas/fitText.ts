import { fitPath, trimToFit } from '../../../lib/trimToFit';

const MAX_CACHED = 5000;
const cache = new Map<string, string>();

/**
 * Shortens `text` with an ellipsis so it fits `maxWidth` in the context's current font.
 * Results are cached per font and width: measuring text is the costliest part of drawing labels.
 */
export function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  return cached(`${ctx.font}|${Math.round(maxWidth)}|${text}`, () => trimToFit(text, maxWidth, (part) => ctx.measureText(part).width));
}

/**
 * Shortens a branch name the way `PathLabel` does (`fitPath`): parent branches go from the middle (`/main/…/child/task`)
 * so the leaf stays whole; only a leaf too wide on its own is cut, in its middle (`…/rendering-pi…set-bundles`).
 */
export function fitBranchName(ctx: CanvasRenderingContext2D, name: string, maxWidth: number): string {
  return cached(`branch|${ctx.font}|${Math.round(maxWidth)}|${name}`, () => {
    const leafStart = name.lastIndexOf('/') + 1;
    const fitted = fitPath(name.slice(0, leafStart), name.slice(leafStart), maxWidth, (text) => ctx.measureText(text).width);
    return fitted.folder + fitted.name;
  });
}

const widths = new Map<string, number>();

/** The width of `text` in the context's current font, cached like the fitted texts. */
export function textWidth(ctx: CanvasRenderingContext2D, text: string): number {
  const key = `${ctx.font}|${text}`;
  let width = widths.get(key);
  if (width === undefined) {
    if (widths.size > MAX_CACHED) widths.clear();
    widths.set(key, (width = ctx.measureText(text).width));
  }
  return width;
}

function cached(key: string, fit: () => string): string {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const fitted = fit();
  if (cache.size > MAX_CACHED) cache.clear();
  cache.set(key, fitted);
  return fitted;
}

const summaries = new Map<string, string>();

/** The first line of a comment, which is its summary. Asked for on every frame, so remembered. */
export function summaryOf(comment: string): string {
  if (!comment) return '';
  let summary = summaries.get(comment);
  if (summary === undefined) {
    if (summaries.size > MAX_CACHED) summaries.clear();
    summaries.set(comment, (summary = comment.split('\n', 1)[0]!.trim()));
  }
  return summary;
}
