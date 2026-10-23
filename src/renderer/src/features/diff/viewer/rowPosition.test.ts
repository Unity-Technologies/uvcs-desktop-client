import { describe, expect, it } from 'vitest';
import { lineOfRow, scrollTopFor, TOP_PROBE_REACH, topProbePoints } from './rowPosition';

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
