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
  const shortened = (kept: number): string => chars.slice(0, kept).join('') + ELLIPSIS;
  return shortened(mostCharactersFitting(chars.length, (kept) => measure(shortened(kept)) <= maxWidth));
}

/** The longest suffix of `text` that, after an ellipsis, fits in `maxWidth`: `text` itself when it fits, '' when not even the ellipsis does. */
export function trimStartToFit(text: string, maxWidth: number, measure: Measure): string {
  if (measure(text) <= maxWidth) return text;
  if (measure(ELLIPSIS) > maxWidth) return '';
  const chars = Array.from(text);
  const shortened = (kept: number): string => ELLIPSIS + chars.slice(chars.length - kept).join('');
  return shortened(mostCharactersFitting(chars.length, (kept) => measure(shortened(kept)) <= maxWidth));
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
  return shortened(mostCharactersFitting(chars.length, (kept) => measure(shortened(kept)) <= maxWidth));
}

/**
 * The most characters (fewer than `length`, which is too wide) a shortened text can keep and still fit, found by halving:
 * keeping fewer never makes it wider. None when not even one fits.
 */
function mostCharactersFitting(length: number, fits: (kept: number) => boolean): number {
  let fitting = 0;
  let tooWide = length;
  while (tooWide - fitting > 1) {
    const middle = (fitting + tooWide) >> 1;
    if (fits(middle)) fitting = middle;
    else tooWide = middle;
  }
  return fitting;
}

/** The fewest characters of a last folder worth showing once it is cut; with less room it is dropped whole. */
const MIN_CUT_FOLDER_CHARS = 4;

/**
 * A folder (ending in `/`) shortened to fit by dropping whole segments from its middle, so what is left still reads
 * as a path: `/main/…/child_1/` for `/main/child-br/empty-branch2/child_1/`. Keeps the first segment and as many of
 * the last ones as fit; when not even the last one does, it is cut rather than dropped, since it tells rows apart
 * (`trimLastFolderToFit`); when not even `/main/…/` fits, just `…/`, or nothing.
 */
export function trimFolderToFit(folder: string, maxWidth: number, measure: Measure): string {
  if (measure(folder) <= maxWidth) return folder;
  const headEnd = folder.indexOf('/', folder.startsWith('/') ? 1 : 0) + 1;
  const segments = folder.slice(headEnd, -1).split('/');
  const head = folder.slice(0, headEnd) + ELLIPSIS + '/';
  for (let kept = segments.length - 1; headEnd > 0 && kept >= 1; kept--) {
    const shortened = head + segments.slice(segments.length - kept).map((segment) => `${segment}/`).join('');
    if (measure(shortened) <= maxWidth) return shortened;
  }
  const lastCut = headEnd > 0 ? trimLastFolderToFit(folder.slice(0, headEnd), folder.slice(headEnd), segments.length, maxWidth, measure) : '';
  if (lastCut) return lastCut;
  if (headEnd > 0 && measure(head) <= maxWidth) return head;
  return measure(`${ELLIPSIS}/`) <= maxWidth ? `${ELLIPSIS}/` : '';
}

/**
 * The first segment and what follows it cut to fit with a single ellipsis, so the path still has one cut: the last
 * folder from its middle when it is the only one after the first (`3DModels/heart_-_an…_3d_model/`), else everything
 * after the first from its start, the dropped folders with the start of the last (`Assets/…-_animated_model/`). The
 * whole folder doesn't fit, so either cut always leaves an ellipsis. '' when fewer than `MIN_CUT_FOLDER_CHARS` of the
 * last folder would be left.
 */
function trimLastFolderToFit(first: string, rest: string, segmentCount: number, maxWidth: number, measure: Measure): string {
  const room = maxWidth - measure(first);
  const cut = segmentCount === 1 ? trimMiddleToFit(rest, room, measure) : trimStartToFit(rest, room, measure);
  const keptChars = Array.from(cut).length - ELLIPSIS.length - '/'.length;
  // Measured joined too: kerning can make the whole a fraction wider than its parts.
  return keptChars >= MIN_CUT_FOLDER_CHARS && measure(first + cut) <= maxWidth ? first + cut : '';
}

/** The fewest characters of a name worth showing after a `…/`; with less room the name gets it all. */
const MIN_NAME_CHARS = 4;

/**
 * A path (`/main/task/login`, `src/app/main.ts`) as a folder and a name shortened to fit, always the same way: whole
 * folders go from the middle of the folder first (`/main/…/login`), then the last folder is cut (`trimFolderToFit`),
 * then the folder down to `…/`, and only then the name, from its middle so both ends still tell it apart
 * (`…/ghost-mo…fix`). The `…/` stays while the name keeps a few characters, so a shortened path never reads as a
 * top-level one.
 */
export function fitPath(folder: string, name: string, maxWidth: number, measure: Measure): { folder: string; name: string } {
  const nameWidth = measure(name);
  if (!folder) return { folder, name: trimMiddleToFit(name, maxWidth, measure) };
  const trimmedFolder = trimFolderToFit(folder, maxWidth - nameWidth, measure);
  if (trimmedFolder) return { folder: trimmedFolder, name };

  const hint = `${ELLIPSIS}/`;
  const roomForName = maxWidth - measure(hint);
  if (roomForName < measure(Array.from(name).slice(0, MIN_NAME_CHARS).join('') + ELLIPSIS)) return { folder: '', name: trimMiddleToFit(name, maxWidth, measure) };
  return { folder: hint, name: trimMiddleToFit(name, roomForName, measure) };
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

/**
 * The whole pixels a label showing a path needs, the name's alone too, with one to spare so a rounded-up width never
 * clips it: the path whole, or once fitted to `maxWidth` (`fitPath`), so a label fitted there is as wide as what it shows.
 */
export function fittedPathWidth(folder: string, name: string, measure: Measure, maxWidth?: number): { width: number; nameWidth: number } {
  const shown = maxWidth === undefined ? { folder, name } : fitPath(folder, name, maxWidth - 1, measure);
  const nameWidth = Math.ceil(measure(shown.name)) + 1;
  return { width: Math.ceil(measure(shown.folder)) + nameWidth, nameWidth };
}
