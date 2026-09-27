import { FileDiff, type DiffHunksRenderer } from '@pierre/diffs';
import { describe, expect, it } from 'vitest';
import { lineDiffOptions } from './lineDiff';
import { installPierreLineComparison } from './pierreLineComparison';
import { changesOf, typedIntoPierre } from './pierreSessionFixture';

describe('Pierre typed into under a comparison method', () => {
  it('hands the comparison to the renderer that re-diffs every keystroke', () => {
    installPierreLineComparison();
    const parseDiffOptions = lineDiffOptions('a\n', 'b\n', 'ignoreWhitespace');
    const component = new FileDiff({ parseDiffOptions }) as unknown as { hunksRenderer: DiffHunksRenderer };
    expect(component.hunksRenderer.options.parseDiffOptions).toBe(parseDiffOptions);
  });

  it('shows no change for spaces typed at the end of an unchanged line when whitespace is ignored', async () => {
    const session = await typedIntoPierre('a\nb\nc\nd\ne\nf\n', 'a\nB\nc\nd\ne\nf\n', 'ignoreEolAndWhitespace');
    session.type(4, 'e   ');
    expect(session.diff.additionLines[4]).toBe('e   \n');
    expect(changesOf(session.diff)).toEqual([{ at: 1, removed: 1, added: 1 }]);
  });

  it('still shows those spaces when every character counts', async () => {
    const session = await typedIntoPierre('a\nb\nc\nd\ne\nf\n', 'a\nB\nc\nd\ne\nf\n', 'recognizeAll');
    session.type(4, 'e   ');
    expect(changesOf(session.diff)).toEqual([
      { at: 1, removed: 1, added: 1 },
      { at: 4, removed: 1, added: 1 },
    ]);
  });

  it('drops a change typed back to its original line with other indentation', async () => {
    const session = await typedIntoPierre('a\n  b\nc\nd\n', 'a\nB\nc\nd\n', 'ignoreWhitespace');
    session.type(1, '\tb ');
    expect(changesOf(session.diff)).toEqual([]);
  });

  it('still shows the changes a comparator sees in text typed back to the original', async () => {
    // Lone CRs against LFs: the same text as shown, every line different under Recognize all.
    const session = await typedIntoPierre('one\rtwo\rthree\r', 'one\ntwo\nthree\n', 'recognizeAll');
    const EVERY_LINE = [{ at: 0, removed: 3, added: 3 }];
    session.type(1, 'twox');
    expect(changesOf(session.diff)).toEqual(EVERY_LINE);
    session.type(1, 'two');
    expect(session.diff.additionLines).toEqual(session.diff.deletionLines);
    expect(changesOf(session.diff)).toEqual(EVERY_LINE);
    session.replace('one\ntwo\n\nthree\n');
    expect(changesOf(session.diff)).toEqual([{ at: 0, removed: 3, added: 4 }]);
    session.replace('one\ntwo\nthree\n');
    expect(changesOf(session.diff)).toEqual(EVERY_LINE);
  });

  it("re-renders the diff whole when a keystroke reaches the editor's empty last line, which has no row in it", async () => {
    const session = await typedIntoPierre('one\ntwo\nthree\n', 'one\ntwo\nthreeX\n', 'recognizeAll');
    expect(session.retokenize(2, ['threeXY', ''])).toBe(true);
    expect(session.retokenize(2, ['threeX'])).toBe(false);
  });
});
