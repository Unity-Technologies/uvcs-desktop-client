import { WORD_MARKS } from '../../diff/viewer/pierreOptions';
import { coveredMarks, lineWordMarks, type WordMarksByLine } from '../../diff/viewer/wordMarkRows';
import { suggestionLineDiff } from './suggestionLineDiff';

/**
 * The words a stacked suggestion marks (`replacedThenSuggested`): each line the suggestion edits against the line it
 * became, as the line diff of the two pairs them (`suggestionLineDiff`), whatever lines it adds or removes around them.
 * Pierre pairs the n-th line removed with the n-th added, which stacked lines would mark wrong as soon as the
 * suggestion has another number of lines; so its marks are off there, and these drawn over the rows (`useWordMarks`),
 * by the rows' line numbers, the file's from `firstLine`.
 */
export function stackedWordMarks(replacedText: string, suggestedText: string, firstLine: number): WordMarksByLine {
  const marks: WordMarksByLine = { deletions: new Map(), additions: new Map() };
  const diff = suggestionLineDiff({ name: 'replaced', contents: replacedText }, { name: 'suggested', contents: suggestedText }, firstLine);
  for (const part of diff.hunks.flatMap((hunk) => hunk.hunkContent)) {
    if (part.type !== 'change') continue;
    for (let pair = 0; pair < Math.min(part.deletions, part.additions); pair++) {
      const deletion = part.deletionLineIndex + pair;
      const addition = part.additionLineIndex + pair;
      const lineMarks = lineWordMarks(diff.deletionLines[deletion] ?? '', diff.additionLines[addition] ?? '', WORD_MARKS.lineDiffType, WORD_MARKS.maxLineDiffLength);
      marks.deletions.set(firstLine + deletion, coveredMarks(lineMarks.deletion));
      marks.additions.set(firstLine + addition, coveredMarks(lineMarks.addition));
    }
  }
  return marks;
}
