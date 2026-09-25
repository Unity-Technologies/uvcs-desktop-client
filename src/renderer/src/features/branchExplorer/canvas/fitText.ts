import { trimFolderToFit } from '../../../lib/trimToFit';

const ELLIPSIS = '…';
const MAX_CACHED = 5000;
const cache = new Map<string, string>();

/**
 * Shortens `text` with an ellipsis so it fits `maxWidth` in the context's current font.
 * Results are cached per font and width: measuring text is the costliest part of drawing labels.
 */
export function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  return cached(`${ctx.font}|${Math.round(maxWidth)}|${text}`, () => (ctx.measureText(text).width <= maxWidth ? text : shorten(ctx, text, maxWidth)));
}

/**
 * Shortens a branch name the way `PathLabel` does: parent branches go from the middle (`/main/…/child/task`) so the
 * leaf stays whole; only a leaf too wide on its own is cut.
 */
export function fitBranchName(ctx: CanvasRenderingContext2D, name: string, maxWidth: number): string {
  return cached(`branch|${ctx.font}|${Math.round(maxWidth)}|${name}`, () => {
    const leafStart = name.lastIndexOf('/') + 1;
    const leaf = name.slice(leafStart);
    const leafWidth = ctx.measureText(leaf).width;
    if (leafWidth > maxWidth) return fitText(ctx, leaf, maxWidth);
    return trimFolderToFit(name.slice(0, leafStart), maxWidth - leafWidth, (text) => ctx.measureText(text).width) + leaf;
  });
}

function cached(key: string, fit: () => string): string {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const fitted = fit();
  if (cache.size > MAX_CACHED) cache.clear();
  cache.set(key, fitted);
  return fitted;
}

/** Binary search for the longest prefix that fits together with the ellipsis. */
function shorten(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  let low = 0;
  let high = text.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (ctx.measureText(text.slice(0, middle).trimEnd() + ELLIPSIS).width <= maxWidth) low = middle;
    else high = middle - 1;
  }
  return low === 0 ? '' : text.slice(0, low).trimEnd() + ELLIPSIS;
}

/** The first line of a comment, which is its summary. */
export function summaryOf(comment: string): string {
  return comment.split('\n', 1)[0]!.trim();
}
