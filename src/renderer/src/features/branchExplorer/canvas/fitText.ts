import { trimFolderToFit, trimToFit } from '../../../lib/trimToFit';

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

/** The first line of a comment, which is its summary. */
export function summaryOf(comment: string): string {
  return comment.split('\n', 1)[0]!.trim();
}
