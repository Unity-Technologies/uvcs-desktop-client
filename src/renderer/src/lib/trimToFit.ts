export const ELLIPSIS = '…';

type Measure = (text: string) => number;

/**
 * The longest prefix of `text` that, followed by an ellipsis, fits in `maxWidth`: `text` itself when it fits,
 * '' when not even the ellipsis does. Cuts between code points, so surrogate pairs stay whole.
 */
export function trimToFit(text: string, maxWidth: number, measure: Measure): string {
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

/**
 * `text` with its middle cut out to fit in `maxWidth`, keeping as much of both ends as fits (the start one character
 * longer when they can't be even): `cm upd…/work/game` still tells the command and what it ran on. '' when not even the
 * ellipsis fits.
 */
export function trimMiddleToFit(text: string, maxWidth: number, measure: Measure): string {
  if (measure(text) <= maxWidth) return text;
  if (measure(ELLIPSIS) > maxWidth) return '';
  const chars = Array.from(text);
  const shortened = (kept: number): string =>
    chars.slice(0, Math.ceil(kept / 2)).join('') + ELLIPSIS + chars.slice(chars.length - Math.floor(kept / 2)).join('');
  let fits = 0;
  let tooWide = chars.length;
  while (tooWide - fits > 1) {
    const middle = (fits + tooWide) >> 1;
    if (measure(shortened(middle)) <= maxWidth) fits = middle;
    else tooWide = middle;
  }
  return shortened(fits);
}

/**
 * A folder (ending in `/`) shortened to fit by dropping whole segments from its middle, so what is left still reads
 * as a path: `/main/…/child_1/` for `/main/child-br/empty-branch2/child_1/`. Keeps the first segment and as many of
 * the last ones as fit; when not even `/main/…/` does, just `…/`, or nothing.
 */
export function trimFolderToFit(folder: string, maxWidth: number, measure: Measure): string {
  if (measure(folder) <= maxWidth) return folder;
  const headEnd = folder.indexOf('/', folder.startsWith('/') ? 1 : 0) + 1;
  const segments = folder.slice(headEnd, -1).split('/');
  const head = folder.slice(0, headEnd) + ELLIPSIS + '/';
  for (let kept = segments.length - 1; headEnd > 0 && kept >= 0; kept--) {
    const shortened = head + segments.slice(segments.length - kept).map((segment) => `${segment}/`).join('');
    if (measure(shortened) <= maxWidth) return shortened;
  }
  return measure(`${ELLIPSIS}/`) <= maxWidth ? `${ELLIPSIS}/` : '';
}

/** Where character positions of `text` (search matches) land once it is shortened to `shown`; cut ones are left out. */
export function positionsInTrimmed(text: string, shown: string, positions: readonly number[]): number[] {
  if (shown === text) return [...positions];
  let kept = 0;
  while (kept < shown.length && shown[kept] === text[kept]) kept++;
  const tailStart = text.length - (shown.length - kept - ELLIPSIS.length);
  const shift = kept + ELLIPSIS.length - tailStart;
  return positions.flatMap((position) => (position < kept ? [position] : position >= tailStart ? [position + shift] : []));
}
