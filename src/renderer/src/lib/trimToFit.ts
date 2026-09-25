export const ELLIPSIS = '…';

/**
 * The longest prefix of `text` that, followed by an ellipsis, fits in `maxWidth`: `text` itself when it fits,
 * '' when not even the ellipsis does. Cuts between code points, so surrogate pairs stay whole.
 */
export function trimToFit(text: string, maxWidth: number, measure: (text: string) => number): string {
  if (measure(text) <= maxWidth) return text;
  if (measure(ELLIPSIS) > maxWidth) return '';
  const chars = Array.from(text);
  let fits = 0;
  let tooWide = chars.length;
  while (tooWide - fits > 1) {
    const middle = (fits + tooWide) >> 1;
    if (measure(chars.slice(0, middle).join('') + ELLIPSIS) <= maxWidth) fits = middle;
    else tooWide = middle;
  }
  return chars.slice(0, fits).join('') + ELLIPSIS;
}
