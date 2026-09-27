import { describe, expect, it } from 'vitest';
import { blockLines, listChangeBlocks, listChangeRegions } from './changeBlocks';
import { crAgainstLf, endsWithLineBreak, splitLines } from '../../../lib/lineBreaks';
import { COMPARISON_METHODS, ignoresLineEndings, type ComparisonMethod } from './comparisonMethod';
import { DIFF_TEST_TEXTS } from './diffTestTexts';
import { discardLines, withOwnLines } from './discardLines';
import { hasLineChanges, lineDiff } from './lineDiff';
import type { ChangedLine } from './changeBlocks';

/**
 * Discarding as the diff viewer does (`useBlockDiscard`): from the one diff of the texts under the comparison method
 * (`lineDiff`), over the texts' own lines, under every method and every kind of text.
 */

function discard(original: string, modified: string, method: ComparisonMethod, lines: (regions: ChangedLine[][]) => ChangedLine[]): string {
  const { meta } = lineDiff(original, modified, method);
  const regions = listChangeRegions(listChangeBlocks(meta)).map((region) => region.lines);
  return discardLines(withOwnLines(meta, original, modified), lines(regions), method).text;
}

const changedLineCount = (original: string, modified: string, method: ComparisonMethod): number => {
  const { added, removed } = lineDiff(original, modified, method);
  return added + removed;
};

describe('discarding from a diff', () => {
  for (const [name, [original, modified]] of Object.entries(DIFF_TEST_TEXTS)) {
    for (const { value: method } of COMPARISON_METHODS) {
      if (!hasLineChanges(lineDiff(original, modified, method))) continue;

      it(`takes the file back to its original change by change: ${name}, ${method}`, () => {
        let text = modified;
        for (let changes = 0; hasLineChanges(lineDiff(original, text, method)); changes++) {
          expect(changes).toBeLessThan(20);
          text = discard(original, text, method, (regions) => regions[0]!);
        }
        // What's left differs only in what the method hides; when every character counts, nothing does.
        if (method === 'recognizeAll') expect(text).toBe(original);
      });

      it(`takes the file back to its original when every change goes at once: ${name}, ${method}`, () => {
        const text = discard(original, modified, method, (regions) => regions.flat());
        expect(hasLineChanges(lineDiff(original, text, method))).toBe(false);
        if (method === 'recognizeAll') expect(text).toBe(original);
      });

      // A file of lone CRs against one of LFs shows every line changed; one line taken back makes it mix both, and a
      // file mixing them can't tell which of its LFs were CRs (`crAgainstLf`): its other lines show as they read.
      if (crAgainstLf(original, modified) && !ignoresLineEndings(method)) continue;

      it(`takes one line back and leaves every other change: ${name}, ${method}`, () => {
        const { meta } = lineDiff(original, modified, method);
        const before = changedLineCount(original, modified, method);
        // The original's last line without a line break, taken back before added lines, gets one: where line endings
        // count, that's a change of its own.
        const lastWithoutBreak = !endsWithLineBreak(original) && !ignoresLineEndings(method) ? splitLines(original).length : 0;
        for (const line of listChangeBlocks(meta).flatMap(blockLines)) {
          if (line.side === 'deletions' && line.lineNumber === lastWithoutBreak) continue;
          const text = discard(original, modified, method, () => [line]);
          expect(changedLineCount(original, text, method), `${line.side} ${line.lineNumber}`).toBe(before - 1);
        }
      });
    }
  }
});
