import { describe, expect, it } from 'vitest';
import { lineActionDragBand, lineActionDragFrom, lineActionDragEnds, lineActionDragLines, lineActionDragMoved, lineActionDragTo } from './lineActionDrag';

const at = (lineNumber: number, side: 'additions' | 'deletions' = 'additions') => ({ side, lineNumber });

describe('a drag from the "+"', () => {
  it('starts on its line, which alone is a click', () => {
    const drag = lineActionDragFrom(at(12));
    expect(lineActionDragMoved(drag)).toBe(false);
    expect(lineActionDragLines(drag)).toEqual({ side: 'additions', firstLineNumber: 12, lineNumber: 12 });
  });

  it('stretches down or up over the lines of its side, first to last', () => {
    expect(lineActionDragLines(lineActionDragTo(lineActionDragFrom(at(12)), at(18)))).toEqual({ side: 'additions', firstLineNumber: 12, lineNumber: 18 });
    expect(lineActionDragLines(lineActionDragTo(lineActionDragFrom(at(12)), at(9)))).toEqual({ side: 'additions', firstLineNumber: 9, lineNumber: 12 });
    expect(lineActionDragMoved(lineActionDragTo(lineActionDragFrom(at(12)), at(9)))).toBe(true);
  });

  it("stays where it was over the other side's lines", () => {
    const drag = lineActionDragTo(lineActionDragFrom(at(12)), at(15));
    expect(lineActionDragTo(drag, at(20, 'deletions'))).toEqual(drag);
  });

  it('outlines the lines dragged over in the accent, a "+" on the first and the last', () => {
    const drag = lineActionDragTo(lineActionDragFrom(at(12)), at(9));
    expect(lineActionDragBand(drag)).toMatchObject({ side: 'additions', firstLineNumber: 9, lineNumber: 12, selected: true });
    expect(lineActionDragEnds(drag).map((end) => end.lineNumber)).toEqual([9, 12]);
  });

  it('outlines one line, one "+", before the drag leaves it', () => {
    const drag = lineActionDragFrom(at(12));
    expect(lineActionDragBand(drag)).not.toHaveProperty('firstLineNumber');
    expect(lineActionDragEnds(drag).map((end) => end.lineNumber)).toEqual([12]);
  });
});
