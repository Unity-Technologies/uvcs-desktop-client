import type { Hunk } from '@pierre/diffs';
import { lineDiff } from '../../diff/viewer/lineDiff';

/**
 * Where line `line` of an earlier version of a file is in a newer one, when it is still there unchanged: a comment
 * written on it reads the same at that line. None when the line was changed or removed (the comment is outdated), or
 * is past the earlier version's end. Line ends don't count: a file that only went from LF to CRLF keeps its comments.
 */
export function newerLineOf(earlier: string, newer: string, line: number, changed: ChangedLineGoes = 'nowhere'): number | null {
  return newerLineFinder(newer)(earlier, line, changed);
}

/**
 * Where a changed or removed line goes: nowhere (a comment on it is outdated), or to its change, the first line that
 * replaced it or the line after the lines removed (a thread the change settled reads beside it).
 */
export type ChangedLineGoes = 'nowhere' | 'toItsChange';

/** An earlier version's line diff against the newer one: its hunks, and how many lines the earlier version has. */
export interface VersionDiff {
  hunks: readonly Pick<Hunk, 'deletionStart' | 'additionStart' | 'hunkContent'>[];
  earlierLineCount: number;
  newerLineCount: number;
}

function versionDiff(earlier: string, newer: string): VersionDiff {
  const { meta } = lineDiff(earlier, newer, 'ignoreEol');
  return { hunks: meta.hunks, earlierLineCount: meta.deletionLines.length, newerLineCount: meta.additionLines.length };
}

/**
 * `newerLineOf` for many lines of a few earlier versions into one newer version: each earlier version is diffed once,
 * however many threads were written on it (a whole-file diff each, on the renderer's thread).
 */
export function newerLineFinder(newer: string, diffOf: (earlier: string, newer: string) => VersionDiff = versionDiff): (earlier: string, line: number, changed?: ChangedLineGoes) => number | null {
  const diffs = new Map<string, VersionDiff>();
  return (earlier, line, changed = 'nowhere') => {
    if (line < 1) return null;
    let diff = diffs.get(earlier);
    if (!diff) {
      diff = diffOf(earlier, newer);
      diffs.set(earlier, diff);
    }
    const newerLine = newerLineIn(diff.hunks, line, diff.earlierLineCount, changed);
    // A change at the very end that only removed lines goes to the line after them, which the newer version hasn't.
    return newerLine !== null && newerLine <= diff.newerLineCount ? newerLine : null;
  };
}

/** `newerLineOf` over the hunks of a line diff, `earlierLineCount` the earlier version's lines. */
export function newerLineIn(
  hunks: readonly Pick<Hunk, 'deletionStart' | 'additionStart' | 'hunkContent'>[],
  line: number,
  earlierLineCount: number,
  changed: ChangedLineGoes = 'nowhere',
): number | null {
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
        if (line < earlierLine + part.deletions) return changed === 'toItsChange' ? newerLine : null;
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
