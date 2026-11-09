import { describe, expect, it } from 'vitest';
import { FRAME_MARGIN, framedScrollTop, lineOfRow, scrollTopFor, TOP_PROBE_REACH, topProbePoints } from './rowPosition';

describe('topProbePoints', () => {
  const view = { left: 100, top: 50, width: 800, bottom: 1050 };

  it('looks at each height on the modified side, then the original side (the rows across from a removed block)', () => {
    expect(topProbePoints(view).slice(0, 4)).toEqual([
      { x: 700, y: 51 },
      { x: 300, y: 51 },
      { x: 700, y: 59 },
      { x: 300, y: 59 },
    ]);
  });

  it('looks only so far down the view', () => {
    const ys = topProbePoints(view).map((point) => point.y);
    expect(Math.max(...ys)).toBeLessThan(view.top + TOP_PROBE_REACH);
  });

  it('looks no lower than the bottom of a short view, and nowhere in one with no height', () => {
    expect(topProbePoints({ ...view, bottom: 70 }).every((point) => point.y < 70)).toBe(true);
    expect(topProbePoints({ ...view, bottom: view.top })).toEqual([]);
  });
});

describe('lineOfRow', () => {
  it('reads an added or unchanged line on the modified side', () => {
    expect(lineOfRow('208', 'context')).toEqual({ side: 'additions', lineNumber: 208 });
    expect(lineOfRow('208', 'context-expanded')).toEqual({ side: 'additions', lineNumber: 208 });
    expect(lineOfRow('212', 'change-addition')).toEqual({ side: 'additions', lineNumber: 212 });
  });

  it("reads a removed line on the original's side, by its own number", () => {
    expect(lineOfRow('212', 'change-deletion')).toEqual({ side: 'deletions', lineNumber: 212 });
  });

  it('reads no line from what stands for none: a bar of collapsed lines, a gap', () => {
    expect(lineOfRow(undefined, undefined)).toBeNull();
    expect(lineOfRow('', 'context')).toBeNull();
    expect(lineOfRow('0', 'context')).toBeNull();
    expect(lineOfRow('1.5', 'context')).toBeNull();
    expect(lineOfRow('abc', 'context')).toBeNull();
  });
});

describe('scrollTopFor', () => {
  it('puts the line where its row stood from the top of the view', () => {
    expect(scrollTopFor(4160, 25)).toBe(4135);
    expect(scrollTopFor(4160, -8)).toBe(4168);
  });

  it('never scrolls above the top of the file', () => {
    expect(scrollTopFor(10, 25)).toBe(0);
  });
});

describe('framedScrollTop', () => {
  const view = { scrollTop: 0, height: 400 };

  it('leaves the view where it is when the line and its row show whole, away from the edges', () => {
    expect(framedScrollTop({ lineTop: 100, focusTop: 120, focusBottom: 300 }, view)).toBeNull();
  });

  it('puts a line out of view a third of the way down, its row under it', () => {
    expect(framedScrollTop({ lineTop: 1200, focusTop: 1220, focusBottom: 1300, lineHeight: 20 }, { ...view, height: 600, contentHeight: 10_000 })).toBe(1000);
  });

  it('stops at the end of the content: a comment at the end of a long file', () => {
    expect(framedScrollTop({ lineTop: 9800, focusTop: 9820, focusBottom: 9990, lineHeight: 20 }, { ...view, height: 600, contentHeight: 10_000 })).toBe(9400);
  });

  it('moves a row that ends past the view, or against its bottom edge, up into it', () => {
    expect(framedScrollTop({ lineTop: 200, focusTop: 220, focusBottom: 410 }, view)).toBe(100);
    expect(framedScrollTop({ lineTop: 200, focusTop: 220, focusBottom: 390 }, view)).toBe(100);
  });

  it('raises the line above a quarter down so a tall row ends inside the view', () => {
    expect(framedScrollTop({ lineTop: 1000, focusTop: 1020, focusBottom: 1350 }, view)).toBe(1350 - 400 + FRAME_MARGIN);
  });

  it('shows the part gone to from its top when it is taller than the view', () => {
    expect(framedScrollTop({ lineTop: 1000, focusTop: 1300, focusBottom: 2000 }, view)).toBe(1300 - FRAME_MARGIN);
  });

  it('never scrolls above the top of the content', () => {
    expect(framedScrollTop({ lineTop: 0, focusTop: 0, focusBottom: 100 }, { scrollTop: 500, height: 400 })).toBe(0);
  });
});
