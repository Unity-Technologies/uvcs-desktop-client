import { describe, expect, it } from 'vitest';
import { labelSpot, ribbonBox, ribbonPath, sameLayout } from './movedCodeLayout';

const ROW = 20;

describe('labelSpot', () => {
  it('centers the label in the empty rows across from the moved code', () => {
    const gap = { top: 100, bottom: 200, left: 600, right: 1000 };
    expect(labelSpot({ top: 100, bottom: 200 }, [gap], 580, ROW)).toEqual({ top: 150, x: 800, anchor: 'center' });
  });

  it('centers it on the widest part of a gap beside the moved code', () => {
    const gaps = [
      { top: 0, bottom: 120, left: 600, right: 1000 },
      { top: 160, bottom: 400, left: 600, right: 1000 },
    ];
    expect(labelSpot({ top: 100, bottom: 240 }, gaps, 580, ROW)).toEqual({ top: 200, x: 800, anchor: 'center' });
  });

  it("puts it at the end of the moved code's bottom edge, clear of the change's chip, when no gap is across from half of it", () => {
    const quarter = { top: 175, bottom: 200, left: 600, right: 1000 };
    expect(labelSpot({ top: 100, bottom: 200 }, [quarter], 580, ROW)).toEqual({ top: 200, x: 568, anchor: 'end' });
    expect(labelSpot({ top: 100, bottom: 200 }, [], 580, ROW)).toEqual({ top: 200, x: 568, anchor: 'end' });
  });

  it('takes a gap a row high at least, however short the moved code', () => {
    const sliver = { top: 30, bottom: 45, left: 600, right: 1000 };
    expect(labelSpot({ top: 20, bottom: 50 }, [sliver], 580, ROW)).toEqual({ top: 50, x: 568, anchor: 'end' });
  });
});

describe('ribbonBox', () => {
  it('spans both places, whichever is higher', () => {
    expect(ribbonBox({ top: 500, bottom: 600 }, { top: 100, bottom: 160 })).toEqual({ top: 100, bottom: 600 });
  });
});

describe('ribbonPath', () => {
  it('joins the left place to the right one, each edge leaving level and curving to the other side', () => {
    expect(ribbonPath({ top: 500, bottom: 600 }, { top: 100, bottom: 160 }, 28)).toBe('M0 400C14 400 14 0 28 0L28 60C14 60 14 500 0 500Z');
  });

  it('is a straight band between places side by side', () => {
    expect(ribbonPath({ top: 40, bottom: 80 }, { top: 40, bottom: 80 }, 28)).toBe('M0 0C14 0 14 0 28 0L28 40C14 40 14 40 0 40Z');
  });
});

describe('sameLayout', () => {
  const at = (move: object, top: number) => ({ moves: [{ move, deletions: { top, bottom: top + 40 } }] });

  it('keeps what shows when nothing moved on screen', () => {
    const move = {};
    expect(sameLayout(at(move, 100), at(move, 100))).toBe(true);
  });

  it('takes a layout measured anew when a move is placed elsewhere', () => {
    const move = {};
    expect(sameLayout(at(move, 100), at(move, 120))).toBe(false);
  });

  it('takes it when the moves were found anew, equal or not: the move under the pointer is the new one', () => {
    expect(sameLayout(at({ start: 1 }, 100), at({ start: 1 }, 100))).toBe(false);
  });
});
