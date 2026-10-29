import { describe, expect, it } from 'vitest';
import { wheelGoesTo } from './wheelTarget';

describe('wheelGoesTo', () => {
  it('scrolls a caption card’s long comment under the pointer, not the graph behind it', () => {
    expect(wheelGoesTo({ inCaptionCard: true, zoom: false })).toBe('card');
  });

  it('pans or zooms the graph everywhere else, and zooms it from over a card too, never the page', () => {
    expect(wheelGoesTo({ inCaptionCard: false, zoom: false })).toBe('graph');
    expect(wheelGoesTo({ inCaptionCard: true, zoom: true })).toBe('graph');
  });
});
