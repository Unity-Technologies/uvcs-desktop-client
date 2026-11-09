import { describe, expect, it } from 'vitest';
import type { ChangedLine } from './changeBlocks';
import type { ChangeMapLayout, LineBox } from './changeMarks';
import { lowestTickTop, mapTickMarks, TICK_FUSE_GAP, TICK_HEIGHT, type MapTick } from './mapTicks';

const ROW = 20;

const tick = (side: ChangedLine['side'], lineNumber: number, emphasized = false): MapTick => ({ key: `${side}:${lineNumber}`, side, lineNumber, emphasized });

/** 200 lines a side, a row each, in a track a tenth of the content: a line's tick is at twice its index. */
function layout(boxOf: (line: ChangedLine) => LineBox | undefined = ({ lineNumber }) => ({ top: (lineNumber - 1) * ROW, height: ROW })): ChangeMapLayout {
  return { boxOf, lineCounts: { deletions: 200, additions: 200 }, contentHeight: 200 * ROW, trackHeight: 400 };
}

describe('mapTickMarks', () => {
  it('ticks each spot at the top of its line where Pierre lays it out, scaled to the track', () => {
    expect(mapTickMarks([tick('additions', 51)], layout())).toEqual([{ top: 100, emphasized: false, keys: ['additions:51'] }]);
  });

  it("places a removed line's spot on the older side's line, as Pierre lays that side out", () => {
    const boxOf = ({ side, lineNumber }: ChangedLine): LineBox => ({ top: (lineNumber - 1 + (side === 'deletions' ? 10 : 0)) * ROW, height: ROW });
    expect(mapTickMarks([tick('deletions', 51)], layout(boxOf))[0]?.top).toBe(120);
  });

  it("places a line at its share of its side until Pierre can tell where it is", () => {
    expect(mapTickMarks([tick('additions', 101)], layout(() => undefined))[0]?.top).toBe(200);
  });

  it('ticks what is above the code (`lineNumber: 0`: the outdated comments) at the very top of the track', () => {
    const boxOf = (): LineBox => ({ top: 3000, height: ROW });
    expect(mapTickMarks([tick('additions', 0)], layout(boxOf))).toEqual([{ top: 0, emphasized: false, keys: ['additions:0'] }]);
  });

  it('keeps a tick on the last line inside the track', () => {
    expect(mapTickMarks([tick('additions', 200)], layout(() => ({ top: 200 * ROW, height: ROW })))[0]?.top).toBe(400 - TICK_HEIGHT);
  });

  it('orders the ticks top to bottom, whichever side their lines are on', () => {
    const marks = mapTickMarks([tick('deletions', 150), tick('additions', 10), tick('additions', 80)], layout());
    expect(marks.map((mark) => mark.keys)).toEqual([['additions:10'], ['additions:80'], ['deletions:150']]);
  });

  it('fuses ticks too close to tell apart into one, standing out if any of them does', () => {
    // Lines 50 and 52 are 4 px apart in the track: less than a tick and its gap.
    const marks = mapTickMarks([tick('additions', 50), tick('additions', 52, true), tick('additions', 120)], layout());
    expect(marks).toEqual([
      { top: 98, emphasized: true, keys: ['additions:50', 'additions:52'] },
      { top: 238, emphasized: false, keys: ['additions:120'] },
    ]);
  });

  it('keeps ticks apart once the gap between them reads', () => {
    // Two pixels a line: lines this many apart are a tick and its gap apart, or more.
    const apart = Math.ceil((TICK_HEIGHT + TICK_FUSE_GAP) / 2);
    expect(mapTickMarks([tick('additions', 50), tick('additions', 50 + apart)], layout())).toHaveLength(2);
  });

  it('draws at most a tick every few pixels of the track, however many comments a file has', () => {
    const many = Array.from({ length: 200 }, (_, index) => tick('additions', index + 1));
    expect(mapTickMarks(many, layout()).length).toBeLessThanOrEqual(400 / (TICK_HEIGHT + TICK_FUSE_GAP) + 1);
  });

  it('marks nothing before the content or the track has a size', () => {
    expect(mapTickMarks([tick('additions', 5)], { ...layout(), contentHeight: 0 })).toEqual([]);
    expect(mapTickMarks([tick('additions', 5)], { ...layout(), trackHeight: 0 })).toEqual([]);
  });
});

describe('lowestTickTop', () => {
  // A review's order (`commentMapTicks`): the older side's lines, the newer side's, then the outdated ones above the code.
  const reviewOrder = [tick('deletions', 300), tick('additions', 12), tick('additions', 0)];
  const boxOf = ({ side, lineNumber }: ChangedLine): LineBox | undefined => (lineNumber < 1 ? undefined : { top: (lineNumber - 1) * ROW + (side === 'deletions' ? 5 : 0), height: ROW });

  it('is where Pierre lays out the lowest tick, whatever order the place lists them in', () => {
    expect(lowestTickTop(reviewOrder, boxOf)).toBe(299 * ROW + 5);
  });

  it('skips what is above the code, which has no line to measure', () => {
    expect(lowestTickTop([tick('additions', 12), tick('additions', 0)], boxOf)).toBe(11 * ROW);
  });

  it('is none until Pierre can place a tick, or with no ticks', () => {
    expect(lowestTickTop(reviewOrder, () => undefined)).toBeUndefined();
    expect(lowestTickTop([tick('additions', 0)], boxOf)).toBeUndefined();
    expect(lowestTickTop([], boxOf)).toBeUndefined();
  });
});
