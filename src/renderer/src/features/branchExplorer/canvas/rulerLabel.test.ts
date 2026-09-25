import { describe, expect, it } from 'vitest';
import { rulerLabelX } from './rulerLabel';

describe('rulerLabelX', () => {
  it('centers the date in its day', () => {
    expect(rulerLabelX(100, 300, 40, 1000)).toBe(180);
  });

  it('centers it in what is left on screen while the day scrolls away', () => {
    expect(rulerLabelX(-200, 200, 40, 1000)).toBe(80);
  });

  it('never runs into the next day', () => {
    expect(rulerLabelX(-500, 30, 40, 1000)).toBe(30 - 6 - 40);
  });

  it('keeps a small inset from the start of a pinned day', () => {
    expect(rulerLabelX(-50, 20000, 40, 20)).toBe(6);
  });
});
