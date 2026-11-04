import { describe, expect, it } from 'vitest';
import { GLIDE_SHARE, smoothScrollPlan } from './smoothScrollPlan';

const view = { viewHeight: 600, maxScroll: 30_000, reducedMotion: false };
const glide = 600 * GLIDE_SHARE;

describe('smoothScrollPlan', () => {
  it('glides the whole way to a place within a view', () => {
    expect(smoothScrollPlan({ ...view, from: 1000, to: 1500 })).toEqual({ jumpTo: null, glideTo: 1500 });
    expect(smoothScrollPlan({ ...view, from: 1000, to: 400 })).toEqual({ jumpTo: null, glideTo: 400 });
  });

  it('jumps short of a place far below, above it, then glides down to it', () => {
    expect(smoothScrollPlan({ ...view, from: 0, to: 24_000 })).toEqual({ jumpTo: 24_000 - glide, glideTo: 24_000 });
  });

  it('jumps short of a place far above, below it, then glides up to it', () => {
    expect(smoothScrollPlan({ ...view, from: 24_000, to: 300 })).toEqual({ jumpTo: 300 + glide, glideTo: 300 });
  });

  it('keeps the place and the jump within the ends of the content', () => {
    expect(smoothScrollPlan({ ...view, from: 0, to: 40_000 })).toEqual({ jumpTo: 30_000 - glide, glideTo: 30_000 });
    expect(smoothScrollPlan({ ...view, from: 20_000, to: -50 })).toEqual({ jumpTo: glide, glideTo: 0 });
  });

  it('only jumps under reduced motion', () => {
    expect(smoothScrollPlan({ ...view, from: 0, to: 24_000, reducedMotion: true })).toEqual({ jumpTo: 24_000, glideTo: null });
    expect(smoothScrollPlan({ ...view, from: 1000, to: 1200, reducedMotion: true })).toEqual({ jumpTo: 1200, glideTo: null });
  });
});
