import { describe, expect, it } from 'vitest';
import { PLACEMENT_START, placementStep, SETTLED_FRAMES, type SettledPlacement } from './settledPlacement';

const frame = { maxScroll: 10_000 };

/** The placement after scrolling to `target` once. */
const placedAt = (target: number): SettledPlacement => placementStep(PLACEMENT_START, { ...frame, target, scrollTop: 0 }).state;

describe('placementStep', () => {
  it('scrolls to the place the first time, even where the view already is', () => {
    expect(placementStep(PLACEMENT_START, { ...frame, target: 4000, scrollTop: 3000 })).toMatchObject({ scrollTo: 4000, done: false });
    expect(placementStep(PLACEMENT_START, { ...frame, target: 4000, scrollTop: 4000 })).toMatchObject({ scrollTo: 4000, done: false });
  });

  it('is done once the place stood still on frames enough in a row', () => {
    let state = placedAt(4000);
    for (let settled = 1; settled < SETTLED_FRAMES; settled++) {
      const step = placementStep(state, { ...frame, target: 4000, scrollTop: 4000 });
      expect(step).toMatchObject({ scrollTo: null, done: false });
      state = step.state;
    }
    expect(placementStep(state, { ...frame, target: 4000, scrollTop: 4000 }).done).toBe(true);
  });

  it('scrolls again, and starts counting again, when the place moved as the rows above it rendered', () => {
    const settling = placementStep(placedAt(4000), { ...frame, target: 4000, scrollTop: 4000 }).state;
    const moved = placementStep(settling, { ...frame, target: 4600, scrollTop: 4000 });
    expect(moved).toMatchObject({ scrollTo: 4600, done: false });
    expect(placementStep(moved.state, { ...frame, target: 4600, scrollTop: 4600 })).toMatchObject({ scrollTo: null, done: false });
  });

  // Scrolled by the user while it settles, the view stays where the user took it.
  it('leaves the view where the user scrolled it while the place stands still', () => {
    const scrolledAway = placementStep(placedAt(4000), { ...frame, target: 4000, scrollTop: 4350 });
    expect(scrolledAway.scrollTo).toBeNull();
    expect(placementStep(scrolledAway.state, { ...frame, target: 4000, scrollTop: 4800 })).toMatchObject({ scrollTo: null, done: true });
  });

  it('takes a fraction of a pixel off as standing still', () => {
    expect(placementStep(placedAt(4000), { ...frame, target: 4000.5, scrollTop: 4000 }).scrollTo).toBeNull();
  });

  it('stands within the ends of the content, where the view can go', () => {
    expect(placementStep(PLACEMENT_START, { ...frame, target: 12_000, scrollTop: 3000 }).scrollTo).toBe(10_000);
    expect(placementStep(placedAt(12_000), { ...frame, target: 12_500, scrollTop: 10_000 }).scrollTo).toBeNull();
    expect(placementStep(PLACEMENT_START, { ...frame, target: -200, scrollTop: 300 }).scrollTo).toBe(0);
  });
});
