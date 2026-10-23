import { diffArrays } from 'diff';

/**
 * How alike an item deleted from disk and a new one are, from 0 to 1, as `cm`'s own move detection measures it
 * (`FileChangesMatcher` in `cm`'s sources): 1 less the changes per unit of the deleted file, capped at 1.
 * - A text file: the lines a line diff adds and removes (insertions plus deletions, Myers' D), per line of the deleted
 *   file, whitespace and line ends ignored (`cm`'s `bIgnoreEolAndWhitespaces`, on by default).
 * - A binary file: how far the sizes are apart, per byte of the deleted file. `cm` reads no binary content.
 * The official client's Search matches dialog shows the same measure.
 */

/** The lines of a text, compared with whitespace and line ends left out. */
export function comparedLines(text: string): string[] {
  const lines = text.split(/\r\n|\r|\n/);
  // A last line break ends the last line; it opens no line of its own.
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines.map((line) => line.replace(/\s+/g, ''));
}

/**
 * The most a diff may work, in lines times changes: Myers' diff takes about (lines of both) × (changes found) steps,
 * and runs in one go on the main process, which answers no other call meanwhile. A few thousand lines are measured
 * whatever they changed; two large files, only while they're alike (for 50,000 lines each, up to 200 changes).
 */
export const MAX_DIFF_WORK = 20_000_000;

/** The lines' similarity, or null where telling it would take more than `maxWork` (`MAX_DIFF_WORK`). */
export function textSimilarity(deletedLines: readonly string[], addedLines: readonly string[], maxWork = MAX_DIFF_WORK): number | null {
  if (deletedLines.length === 0) return addedLines.length === 0 ? 1 : 0;
  // More changes than the deleted file has lines read as 0, so no diff needs to find more than that many.
  const lines = deletedLines.length;
  if (changesAtLeast(deletedLines, addedLines) >= lines) return 0;
  const limit = Math.min(lines, Math.floor(maxWork / (deletedLines.length + addedLines.length)));
  const ids = lineIds(deletedLines, addedLines);
  const changes = diffArrays(ids.deleted, ids.added, { maxEditLength: limit });
  // Past the limit: no more alike than 0 where it is the file's lines, unknown where the work stopped it first.
  if (changes === undefined) return limit === lines ? 0 : null;
  const changed = changes.reduce((sum, change) => sum + (change.added || change.removed ? change.count : 0), 0);
  return 1 - Math.min(changed, lines) / lines;
}

/** `cm`'s `GetBinChangesPerUnit`: an empty deleted file is alike only another empty one. */
export function sizeSimilarity(deletedSize: number, addedSize: number): number {
  if (deletedSize === 0) return addedSize === 0 ? 1 : 0;
  return 1 - Math.min(Math.abs(addedSize - deletedSize) / deletedSize, 1);
}

/**
 * The fewest changes any diff of the two can have: every line one side holds more often than the other is added or
 * removed. Two unrelated files are told apart from it, without a diff.
 */
function changesAtLeast(deletedLines: readonly string[], addedLines: readonly string[]): number {
  const counts = new Map<string, number>();
  for (const line of deletedLines) counts.set(line, (counts.get(line) ?? 0) + 1);
  let shared = 0;
  for (const line of addedLines) {
    const left = counts.get(line) ?? 0;
    if (left === 0) continue;
    shared++;
    counts.set(line, left - 1);
  }
  return deletedLines.length + addedLines.length - 2 * shared;
}

/** Each line as a number, the same for equal lines: the diff compares numbers, not strings. */
function lineIds(deletedLines: readonly string[], addedLines: readonly string[]): { deleted: number[]; added: number[] } {
  const ids = new Map<string, number>();
  const idOf = (line: string): number => {
    let id = ids.get(line);
    if (id === undefined) ids.set(line, (id = ids.size));
    return id;
  };
  return { deleted: deletedLines.map(idOf), added: addedLines.map(idOf) };
}
