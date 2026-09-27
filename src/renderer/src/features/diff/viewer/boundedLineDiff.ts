import { lineDiff as diffOfLines, type ChangeObject } from 'diff';
import { boundedDiff } from './boundedDiff';

/** What of a line its comparison compares; null: the line equals no other. */
export type LineKey = (line: string) => string | null;

/** `diff`'s options as its line diff reads them. */
interface LineDiffInput {
  comparator?: (left: string, right: string) => boolean;
  ignoreWhitespace?: boolean;
  ignoreCase?: boolean;
  ignoreNewlineAtEof?: boolean;
  newlineIsToken?: boolean;
  oneChangePerToken?: boolean;
  maxEditLength?: number;
  timeout?: number;
}

/** The members of `diff`'s line diff this reaches: `diffWithOptionsObj` is private. */
interface LineDiffer {
  diffWithOptionsObj(oldLines: string[], newLines: string[], options: LineDiffInput, callback?: unknown): ChangeObject<string>[] | undefined;
  postProcess(changes: ChangeObject<string>[], options: LineDiffInput): ChangeObject<string>[];
}

/**
 * Makes every line diff (`diffLines`: ours in `lineDiff`, and Pierre's, typing included) take `boundedDiff`'s time:
 * Myers' algorithm while it's cheap, anchored by unique lines past that. The lines are compared by id, a line's key
 * (`keyOfComparator` for a comparator, the text itself otherwise) read once instead of at every comparison. Options
 * it can't key (`diff`'s own ignores, a comparator it doesn't know, a callback or its own limits) diff as before.
 * `boundedLineDiff.test.ts` fails when an update of `diff` moves what this reaches.
 */
export function installBoundedLineDiff(keyOfComparator: (comparator: (left: string, right: string) => boolean) => LineKey | undefined): void {
  if (installed) return;
  installed = true;
  const differ = diffOfLines as unknown as LineDiffer;
  const unbounded = differ.diffWithOptionsObj;
  differ.diffWithOptionsObj = function (this: LineDiffer, oldLines, newLines, options, callback) {
    const key = callback === undefined ? lineKey(options, keyOfComparator) : undefined;
    if (!key) return unbounded.call(this, oldLines, newLines, options, callback);
    const ids = lineIds(oldLines, newLines, key);
    return this.postProcess(changeObjects(boundedDiff(ids.old, ids.new), oldLines, newLines), options);
  };
}

let installed = false;

function lineKey(options: LineDiffInput, keyOfComparator: (comparator: (left: string, right: string) => boolean) => LineKey | undefined): LineKey | undefined {
  const { comparator, ignoreWhitespace, ignoreCase, ignoreNewlineAtEof, newlineIsToken, oneChangePerToken, maxEditLength, timeout } = options;
  if (ignoreWhitespace || ignoreCase || ignoreNewlineAtEof || newlineIsToken || oneChangePerToken || maxEditLength != null || timeout != null) return undefined;
  return comparator ? keyOfComparator(comparator) : sameText;
}

const sameText: LineKey = (line) => line;

/** Each line as a number, the same for lines that compare equal. */
function lineIds(oldLines: string[], newLines: string[], key: LineKey): { old: number[]; new: number[] } {
  const ids = new Map<string, number>();
  let next = 0;
  const idOf = (line: string): number => {
    const compared = key(line);
    if (compared === null) return next++;
    let id = ids.get(compared);
    if (id === undefined) ids.set(compared, (id = next++));
    return id;
  };
  return { old: oldLines.map(idOf), new: newLines.map(idOf) };
}

/** `diff`'s change objects for an edit script: lines kept take the new text's, like `diff`'s own. */
function changeObjects(runs: ReturnType<typeof boundedDiff>, oldLines: string[], newLines: string[]): ChangeObject<string>[] {
  let oldIndex = 0;
  let newIndex = 0;
  return runs.map(({ count, added, removed }) => {
    const value = removed ? oldLines.slice(oldIndex, oldIndex + count).join('') : newLines.slice(newIndex, newIndex + count).join('');
    if (!added) oldIndex += count;
    if (!removed) newIndex += count;
    return { count, added, removed, value };
  });
}
