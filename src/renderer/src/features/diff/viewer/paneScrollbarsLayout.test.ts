import { describe, expect, it } from 'vitest';
import { paneOverflows, samePaneBars, showsPaneBars, type PaneBar } from './paneScrollbarsLayout';

const pane = (width: number, scrollWidth: number, left = 0): PaneBar => ({ left, width, scrollWidth });

describe('paneOverflows', () => {
  it('needs a bar when the lines are wider than the pane', () => {
    expect(paneOverflows(pane(600, 1400))).toBe(true);
  });

  it('needs none when the lines fit, or overflow only by the pixel a width rounds off', () => {
    expect(paneOverflows(pane(600, 600))).toBe(false);
    expect(paneOverflows(pane(600, 601))).toBe(false);
    expect(paneOverflows(pane(600, 602))).toBe(true);
  });
});

describe('showsPaneBars', () => {
  it('shows the bars when any pane overflows, even if the other fits', () => {
    expect(showsPaneBars([pane(600, 600), pane(600, 1400, 610)])).toBe(true);
  });

  it('shows none when every pane fits, or there are no panes yet', () => {
    expect(showsPaneBars([pane(600, 600), pane(600, 590, 610)])).toBe(false);
    expect(showsPaneBars([])).toBe(false);
  });
});

describe('samePaneBars', () => {
  it('is the same when every pane is where it was, as wide, with code as wide', () => {
    expect(samePaneBars([pane(600, 1400)], [pane(600, 1400)])).toBe(true);
  });

  it('differs when a pane moved, resized, its code widened, or a pane came or went', () => {
    expect(samePaneBars([pane(600, 1400)], [pane(600, 1400, 4)])).toBe(false);
    expect(samePaneBars([pane(600, 1400)], [pane(500, 1400)])).toBe(false);
    expect(samePaneBars([pane(600, 1400)], [pane(600, 1500)])).toBe(false);
    expect(samePaneBars([pane(600, 1400)], [pane(600, 1400), pane(600, 1400, 610)])).toBe(false);
  });
});
