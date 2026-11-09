import type { Hunk } from '@pierre/diffs';
import { lineDiff } from '../../diff/viewer/lineDiff';

/**
 * Where line `line` of an earlier version of a file is in a newer one, when it is still there unchanged: a comment
 * written on it reads the same at that line. None when the line was changed or removed (the comment is outdated), or
 * is past the earlier version's end. Line ends don't count: a file that only went from LF to CRLF keeps its comments.
 */
export function newerLineOf(earlier: string, newer: string, line: number): number | null {
  if (line < 1) return null;
  const { meta } = lineDiff(earlier, newer, 'ignoreEol');
  return newerLineIn(meta.hunks, line, meta.deletionLines.length);
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
