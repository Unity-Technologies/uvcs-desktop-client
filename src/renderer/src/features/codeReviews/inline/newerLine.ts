import type { Hunk } from '@pierre/diffs';
import { lineDiff } from '../../diff/viewer/lineDiff';

/**
 * Where line `line` of an earlier version of a file is in a newer one, when it is still there unchanged: a comment
 * written on it reads the same at that line. None when the line was changed or removed (the comment is outdated), or
 * is past the earlier version's end. Line ends don't count: a file that only went from LF to CRLF keeps its comments.
 */
export function newerLineOf(earlier: string, newer: string, line: number): number | null {
  return newerLineFinder(newer)(earlier, line);
}

/**
 * Where lines `firstLine` to `lastLine` of an earlier version are in a newer one, when the whole block is still there
 * unchanged and together: moved up or down is fine, a line of it changed, removed, or another put inside it is not.
 * One line is `firstLine === lastLine`, as `newerLineOf`.
 */
export function newerRangeOf(earlier: string, newer: string, range: { firstLine: number; lastLine: number }): { firstLine: number; lastLine: number } | null {
  if (range.lastLine < range.firstLine) return null;
  const find = newerLineFinder(newer);
  const first = find(earlier, range.firstLine);
  if (first === null) return null;
  for (let line = range.firstLine + 1; line <= range.lastLine; line++) {
    if (find(earlier, line) !== first + (line - range.firstLine)) return null;
  }
  return { firstLine: first, lastLine: first + (range.lastLine - range.firstLine) };
}

/**
 * `newerRangeOf` with the block's neighbors: the line before it and the line after it (where the earlier version has
 * them) must be there unchanged, right before and after it, too. A line diff pairs lines that read alike, and a short
 * one (a lone `}`, `{`, a blank line, `#endregion`) is alike to many: alone, it can be paired with another such line
 * once code moved around it. Its neighbors pin it.
 */
export function newerRangeInContextOf(earlier: string, newer: string, range: { firstLine: number; lastLine: number }): { firstLine: number; lastLine: number } | null {
  const before = range.firstLine > 1 ? 1 : 0;
  const after = range.lastLine < lineCountOf(earlier) ? 1 : 0;
  const found = newerRangeOf(earlier, newer, { firstLine: range.firstLine - before, lastLine: range.lastLine + after });
  return found && { firstLine: found.firstLine + before, lastLine: found.lastLine - after };
}

/** How many lines a text has, a final line end ending its last line rather than starting another. */
function lineCountOf(text: string): number {
  const lines = text.split(/\r\n|\n|\r/);
  return lines.at(-1) === '' ? lines.length - 1 : lines.length;
}

/** An earlier version's line diff against the newer one: its hunks, and how many lines the earlier version has. */
export interface VersionDiff {
  hunks: readonly Pick<Hunk, 'deletionStart' | 'additionStart' | 'hunkContent'>[];
  earlierLineCount: number;
}

function versionDiff(earlier: string, newer: string): VersionDiff {
  const { meta } = lineDiff(earlier, newer, 'ignoreEol');
  return { hunks: meta.hunks, earlierLineCount: meta.deletionLines.length };
}

/**
 * `newerLineOf` for many lines of a few earlier versions into one newer version: each earlier version is diffed once,
 * however many threads were written on it (a whole-file diff each, on the renderer's thread).
 */
export function newerLineFinder(newer: string, diffOf: (earlier: string, newer: string) => VersionDiff = versionDiff): (earlier: string, line: number) => number | null {
  const diffs = new Map<string, VersionDiff>();
  return (earlier, line) => {
    if (line < 1) return null;
    let diff = diffs.get(earlier);
    if (!diff) {
      diff = diffOf(earlier, newer);
      diffs.set(earlier, diff);
    }
    return newerLineIn(diff.hunks, line, diff.earlierLineCount);
  };
}

/** `newerLineOf` over the hunks of a line diff, `earlierLineCount` the earlier version's lines. */
export function newerLineIn(hunks: readonly Pick<Hunk, 'deletionStart' | 'additionStart' | 'hunkContent'>[], line: number, earlierLineCount: number): number | null {
  if (line < 1 || line > earlierLineCount) return null;
  // Each hunk's lines start where its header says; between hunks, lines move by how far the hunks before moved them.
  let offset = 0;
  for (const hunk of hunks) {
    let earlierLine = hunkStart(hunk.deletionStart);
    let newerLine = hunkStart(hunk.additionStart);
    if (line < earlierLine) return line + offset;
    for (const part of hunk.hunkContent) {
      if (part.type === 'context') {
        if (line < earlierLine + part.lines) return newerLine + (line - earlierLine);
        earlierLine += part.lines;
        newerLine += part.lines;
      } else {
        if (line < earlierLine + part.deletions) return null;
        earlierLine += part.deletions;
        newerLine += part.additions;
      }
    }
    offset = newerLine - earlierLine;
  }
  return line + offset;
}

/**
 * The first line of a hunk's side, from its header's start: a side with no lines in the hunk (`-0,0`) names the line
 * before it, as unified diffs do. Pierre's headers always count context, so a start of 0 is only a side with none.
 */
function hunkStart(start: number): number {
  return Math.max(start, 1);
}
