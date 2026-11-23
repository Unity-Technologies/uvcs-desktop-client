import type { ImageSpot, LineRange } from '@shared/domain/reviewConversation';

/**
 * The lines a review comment is on, from its location as `cm find changereviewcomment` prints it (`{location}`, the
 * server's text, stored from 0): `11` is line 12, `lines:11-17` lines 12 to 18 (`cm codereview comment add
 * --line=12-18`). None for anything else: `-1` (the whole file, or no file), or a kind written with `--location`
 * (`image:120,80`, `commentedImageSpotOf`). `{line}` can't tell them apart: it prints a range's first line alone.
 */
export function commentedLinesOf(location: string): LineRange | null {
  const text = location.trim();
  const line = /^\d+$/.exec(text);
  if (line) return oneBased(Number(text), Number(text));
  const range = /^lines:(\d+)-(\d+)$/.exec(text);
  if (!range) return null;
  const first = Number(range[1]);
  const last = Number(range[2]);
  return last >= first ? oneBased(first, last) : null;
}

function oneBased(first: number, last: number): LineRange {
  return { firstLine: first + 1, lastLine: last + 1 };
}

/** `cm codereview comment add --line`: one line (`42`) or a range (`12-18`), counted from 1, both included. */
export function lineOption({ firstLine, lastLine }: LineRange): string {
  return lastLine > firstLine ? `--line=${firstLine}-${lastLine}` : `--line=${firstLine}`;
}

/**
 * The spot of an image a review comment is on, from its location as `cm find changereviewcomment` prints it: a point,
 * `image:120,80`, or an area from it, `image:120,80,200,140` (x, y, width, height), in the image's own pixels. Every
 * client writes and reads this kind alike, as `cm` doesn't define it (`cm codereview comment add --location`): a number
 * may have decimals (an SVG's units) and never an exponent, and what follows a `;` is a hint a client may ignore. None
 * for anything else, an area with no size, or a negative number.
 */
export function commentedImageSpotOf(location: string): ImageSpot | null {
  const match = /^image:([^;]*)(?:;.*)?$/.exec(location.trim());
  if (!match) return null;
  const numbers = match[1]!.split(',');
  if (!numbers.every((number) => LOCATION_NUMBER.test(number))) return null;
  const [x, y, width, height] = numbers.map(Number);
  if (numbers.length === 2) return { x: x!, y: y! };
  if (numbers.length === 4 && width! > 0 && height! > 0) return { x: x!, y: y!, size: { width: width!, height: height! } };
  return null;
}

/** A number of a location: digits, a decimal part maybe, in the invariant culture ('.'), with no sign or exponent. */
const LOCATION_NUMBER = /^\d+(\.\d+)?$/;

/** `cm codereview comment add --location` on an image: a point (`image:120,80`) or an area (`image:120,80,200,140`). */
export function imageLocationOption({ x, y, size }: ImageSpot): string {
  const numbers = size ? [x, y, size.width, size.height] : [x, y];
  return `--location=image:${numbers.map(locationNumber).join(',')}`;
}

/** A number as `commentedImageSpotOf` reads it: a whole pixel; `String` would write a tiny or huge one with an exponent. */
function locationNumber(value: number): string {
  return String(Math.max(0, Math.round(value)));
}
