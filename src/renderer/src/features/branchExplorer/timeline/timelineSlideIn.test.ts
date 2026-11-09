import { describe, expect, it } from 'vitest';
import { slidesIn } from './timelineSlideIn';

describe('slidesIn', () => {
  it('slides when the user shows the Timeline, and stops when they hide it', () => {
    expect(slidesIn(false, true, false)).toBe(true);
    expect(slidesIn(true, false, true)).toBe(false);
  });

  it('never slides without a toggle: shown as the view opens, or mounted again later', () => {
    expect(slidesIn(true, true, false)).toBe(false);
  });

  it('goes on sliding until the slide is over, whatever renders meanwhile', () => {
    expect(slidesIn(true, true, true)).toBe(true);
  });
});
