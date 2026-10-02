import type { DiffHunksRendererOptionsWithDefaults, FileDiff, FileDiffMetadata } from '@pierre/diffs';
import { changedLinePairs, MAX_WORD_DIFFED_LINE_PAIRS } from './changedLinePairs';
import { coveredMarks, lineWordMarks, markedRow, rowWordMarks, type MarkRange, type RenderedRow } from './wordMarkRows';

/**
 * Makes Pierre (1.5.1) mark the words that changed in a diff typed into, as it does once it's saved; whether the diff
 * was drawn again (not when its marks were right, or it has too many changes to mark). While the editor holds the
 * diff (its edit session), Pierre rebuilds only the rows typed into, from the editor's tokens and with no word marks,
 * and keeps the original's rows, marks and all, as they were: a line typed into showed as changed but none of its
 * words, and the original's line kept marking the words it marked before.
 *
 * This marks the rows the diff's renderer keeps (`renderCache.result.code`) in place: each pair of changed lines
 * (`changedLinePairs`) gets the marks Pierre would give it (`lineWordMarks`) on both sides, and every other row loses
 * the marks it had. Only rows whose marks differ are rebuilt (`markedRow`), from the colored tokens they have, and the
 * diff is drawn again from the rows (`rerender`, as Pierre does when a line is added): nothing is highlighted again,
 * so it costs the same for a file of any size. The render ends by handing the editor its rows back, so the caret,
 * selection and undo stay. A diff with more changed pairs than are worth diffing (`MAX_WORD_DIFFED_LINE_PAIRS`) is
 * left to the save. Pierre has no way to do it itself: `updateRenderCache` rebuilds only the addition rows it's handed,
 * without marks; the refreshes after a keystroke (`refreshSplitDiffView`) only recolor rows; and rendering anew
 * (`refreshHighlightedResult`) does nothing while the editor holds the diff.
 * `pierreWordMarks.test.ts` fails when an update moves what this reaches.
 */
export function refreshWordMarks(fileDiff: Pick<FileDiff, 'rerender'>): boolean {
  const renderer = (fileDiff as unknown as RenderedFileDiff).hunksRenderer;
  const cache = renderer.renderCache;
  const code = cache?.result?.code;
  if (!cache || !code || cache.diff.isPartial) return false;
  const marks = wordMarksOf(cache.diff, renderer.getOptionsWithDefaults());
  if (!marks) return false;
  const deletionLines = remarkedRows(code.deletionLines, marks.deletion);
  const additionLines = remarkedRows(code.additionLines, marks.addition);
  // The rows may be shared with the diff as it was before typing (Pierre's cache of it): replaced, never changed.
  if (deletionLines || additionLines) {
    cache.result = { ...cache.result, code: { ...code, deletionLines: deletionLines ?? code.deletionLines, additionLines: additionLines ?? code.additionLines } };
  } else if (cache.highlighted) {
    // The rows kept are what's on screen: the editor drew the lines typed into from the same tokens, without marks.
    return false;
  }
  // A diff shown as plain text renders its rows anew, marks and all, at every render, so the rows kept may already
  // have the marks of a line the editor drew without them.
  fileDiff.rerender();
  return true;
}

/** The marks each row of each side should show, by line index; undefined when there are too many to work out. */
function wordMarksOf(diff: FileDiffMetadata, { lineDiffType, maxLineDiffLength }: DiffHunksRendererOptionsWithDefaults) {
  const pairs = changedLinePairs(diff);
  if (pairs.length > MAX_WORD_DIFFED_LINE_PAIRS) return undefined;
  const deletion = new Map<number, MarkRange[]>();
  const addition = new Map<number, MarkRange[]>();
  for (const pair of pairs) {
    const marks = lineWordMarks(diff.deletionLines[pair.deletion] ?? '', diff.additionLines[pair.addition] ?? '', lineDiffType, maxLineDiffLength);
    deletion.set(pair.deletion, coveredMarks(marks.deletion));
    addition.set(pair.addition, coveredMarks(marks.addition));
  }
  return { deletion, addition };
}

/** The rows with each one's marks as `marks` has them (none for rows it hasn't); undefined when none changed. */
function remarkedRows(rows: (RenderedRow | undefined)[], marks: Map<number, MarkRange[]>): (RenderedRow | undefined)[] | undefined {
  let remarked: (RenderedRow | undefined)[] | undefined;
  rows.forEach((row, index) => {
    if (!row) return;
    const wanted = marks.get(index) ?? [];
    if (sameMarks(rowWordMarks(row), wanted)) return;
    remarked ??= rows.slice();
    remarked[index] = markedRow(row, wanted);
  });
  return remarked;
}

const sameMarks = (left: MarkRange[], right: MarkRange[]): boolean =>
  left.length === right.length && left.every((mark, index) => mark.start === right[index]!.start && mark.end === right[index]!.end);

/** The members of the component and its renderer this reaches: protected and private. */
interface RenderedFileDiff {
  hunksRenderer: {
    renderCache: { diff: FileDiffMetadata; highlighted: boolean; result?: { code: { deletionLines: (RenderedRow | undefined)[]; additionLines: (RenderedRow | undefined)[] } } } | undefined;
    getOptionsWithDefaults(): DiffHunksRendererOptionsWithDefaults;
  };
}
