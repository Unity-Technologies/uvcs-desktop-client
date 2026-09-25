const ELLIPSIS = '…';
const MAX_CACHED = 5000;
const cache = new Map<string, string>();

/**
 * Shortens `text` with an ellipsis so it fits `maxWidth` in the context's current font.
 * Results are cached per font and width: measuring text is the costliest part of drawing labels.
 */
export function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  const key = `${ctx.font}|${Math.round(maxWidth)}|${text}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const fitted = ctx.measureText(text).width <= maxWidth ? text : shorten(ctx, text, maxWidth);
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
