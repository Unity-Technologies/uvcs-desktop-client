import { parseDiffFromFile, type FileDiffMetadata } from '@pierre/diffs';
import type { DiffLinesOptionsNonabortable } from 'diff';
import { crAgainstLf, shownText, splitLines } from '../../../lib/lineBreaks';
import { syntaxLanguage } from '../../../lib/syntaxLanguage';
import { COMPARISON_METHODS, comparedPart, ignoresLineEndings, type ComparisonMethod } from './comparisonMethod';

/** Options for `diff`'s line diffs, which `@pierre/diffs` takes as `parseDiffOptions`. */
export type LineDiffOptions = Pick<DiffLinesOptionsNonabortable, 'ignoreWhitespace' | 'stripTrailingCr'>;

/**
 * The diff of two texts under a comparison method: the one diff everything about them reads from. The viewer shows it
 * (`shownDiff`), counts it (+N −M), discards from it, and tells from it whether there is anything to show (the whole
 * file is typed into otherwise, and "Only whitespace differs" says why). Pierre re-diffs the text while it's typed into
 * with the same `options` (`pierreLineComparison`), so the diff reads the same typed, saved or shown anew.
 */
export interface LineDiff {
  /** Pierre's diff of the texts as shown, lone CRs as LFs (`shownText`). */
  meta: FileDiffMetadata;
  /** How lines were compared: Pierre's `parseDiffOptions` for this diff. */
  options: LineDiffOptions;
  /** Lines the current text adds and removes, as the diff shows them. */
  added: number;
  removed: number;
}

export function lineDiff(original: string, current: string, method: ComparisonMethod, fileName = 'file'): LineDiff {
  const options = lineDiffOptions(original, current, method);
  const lang = syntaxLanguage(fileName);
  const meta = parseDiffFromFile({ name: fileName, contents: shownText(original) }, { name: fileName, contents: shownText(current), lang }, options);
  let added = 0;
  let removed = 0;
  for (const hunk of meta.hunks) {
    for (const part of hunk.hunkContent) {
      if (part.type !== 'change') continue;
      added += part.additions;
      removed += part.deletions;
    }
  }
  return { meta, options, added, removed };
}

export function hasLineChanges({ added, removed }: Pick<LineDiff, 'added' | 'removed'>): boolean {
  return added > 0 || removed > 0;
}

/**
 * Whether `current` shows any line changed from `original` under `method`. Under a method that ignores something, the
 * texts show none exactly when their lines compare equal one by one, which takes no diff: a quick check, even of big files.
 */
export function differsUnder(original: string, current: string, method: ComparisonMethod): boolean {
  const key = looseLineKey(lineDiffOptions(original, current, method));
  if (!key) return hasLineChanges(lineDiff(original, current, method));
  const left = splitLines(shownText(original));
  const right = splitLines(shownText(current));
  return left.length !== right.length || left.some((line, index) => {
    const compared = key(line);
    return compared === null || compared !== key(right[index]!);
  });
}

/**
 * How to compare the lines of two texts, shown with lone CRs as LFs, under `method`. Lines are compared by what's left
 * of them once the method trims what it ignores (`comparedPart`), through a comparator: `diff` runs it for line diffs
 * too, though it only types it for arrays. Its own `ignoreWhitespace` trims every whitespace, line breaks included:
 * none of the official methods. When one text's LFs were all lone CRs and the other's LFs (`crAgainstLf`), two lines
 * ending with a LF differ unless the method ignores line endings.
 */
export function lineDiffOptions(original: string, current: string, method: ComparisonMethod): LineDiffOptions {
  return (crAgainstLf(original, current) ? OPTIONS_LFS_DIFFER : OPTIONS)[method];
}

/**
 * For options that compare lines as equal that aren't the same text, what of a line they compare (null: equal to no
 * other). Pierre assumes equal lines are the same text in a shortcut while typing (`pierreLineComparison`).
 */
export function looseLineKey(options: LineDiffOptions | undefined): ((line: string) => string | null) | undefined {
  return options && LOOSE_KEYS.get(options);
}

const LOOSE_KEYS = new WeakMap<LineDiffOptions, (line: string) => string | null>();

function comparingUnder(method: ComparisonMethod, lfsDiffer: boolean): LineDiffOptions {
  const key =
    lfsDiffer && !ignoresLineEndings(method)
      ? (line: string): string | null => {
          const compared = comparedPart(line, method);
          return endsWithBareLf(compared) ? null : compared;
        }
      : (line: string): string | null => comparedPart(line, method);
  const comparator = (left: string, right: string): boolean => {
    const compared = key(left);
    return compared !== null && compared === key(right);
  };
  const options = { comparator } as LineDiffOptions;
  // Recognizing all compares the text itself (lone CRs apart from LFs, at most): equal lines are the same text.
  if (method !== 'recognizeAll') LOOSE_KEYS.set(options, key);
  return options;
}

function endsWithBareLf(line: string): boolean {
  return line.endsWith('\n') && !line.endsWith('\r\n');
}

// Built once: options holding the same comparator stay equal between renders, so neither the diff nor Pierre's view of
// it is recomputed.
const OPTIONS = Object.fromEntries(
  COMPARISON_METHODS.map(({ value: method }): [ComparisonMethod, LineDiffOptions] => [method, method === 'recognizeAll' ? {} : comparingUnder(method, false)]),
) as Record<ComparisonMethod, LineDiffOptions>;
const OPTIONS_LFS_DIFFER = Object.fromEntries(
  COMPARISON_METHODS.map(({ value: method }): [ComparisonMethod, LineDiffOptions] => [method, ignoresLineEndings(method) ? OPTIONS[method] : comparingUnder(method, true)]),
) as Record<ComparisonMethod, LineDiffOptions>;
