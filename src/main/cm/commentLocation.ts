import type { LineRange } from '@shared/domain/reviewConversation';

/**
 * The lines a review comment is on, from its location as `cm find changereviewcomment` prints it (`{location}`, the
 * server's text, stored from 0): `11` is line 12, `lines:11-17` lines 12 to 18 (`cm codereview comment add
 * --line=12-18`). None for anything else: `-1` (the whole file, or no file), or a kind another client writes with
 * `--location` (`image:120,80`), which this app doesn't read yet. `{line}` can't tell them apart: it prints a range's
 * first line alone.
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
