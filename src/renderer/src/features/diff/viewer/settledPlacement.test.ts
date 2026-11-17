import { describe, expect, it } from 'vitest';
import { PLACEMENT_START, placementStep, SETTLED_FRAMES } from './settledPlacement';

const frame = { maxScroll: 10_000 };

describe('placementStep', () => {
  it('scrolls to the place while it is elsewhere', () => {
    expect(placementStep(PLACEMENT_START, { ...frame, target: 4000, scrollTop: 3000 })).toEqual({ scrollTo: 4000, done: false, state: { settledFrames: 0 } });
  });

  it('is done once it stood in its place on frames enough in a row', () => {
    let state = PLACEMENT_START;
    for (let settled = 1; settled < SETTLED_FRAMES; settled++) {
      const step = placementStep(state, { ...frame, target: 4000, scrollTop: 4000 });
      expect(step).toEqual({ scrollTo: null, done: false, state: { settledFrames: settled } });
      state = step.state;
    }
    expect(placementStep(state, { ...frame, target: 4000, scrollTop: 4000 }).done).toBe(true);
  });

  it('starts counting again when what was placed moved', () => {
    const settling = placementStep(PLACEMENT_START, { ...frame, target: 4000, scrollTop: 4000 }).state;
    expect(placementStep(settling, { ...frame, target: 4600, scrollTop: 4000 })).toEqual({ scrollTo: 4600, done: false, state: { settledFrames: 0 } });
  });

  it('takes a fraction of a pixel off as in place', () => {
    expect(placementStep(PLACEMENT_START, { ...frame, target: 4000.5, scrollTop: 4000 }).scrollTo).toBeNull();
  });

  it('stands within the ends of the content, where the view can go', () => {
    expect(placementStep(PLACEMENT_START, { ...frame, target: 12_000, scrollTop: 3000 }).scrollTo).toBe(10_000);
    expect(placementStep(PLACEMENT_START, { ...frame, target: 12_000, scrollTop: 10_000 }).scrollTo).toBeNull();
    expect(placementStep(PLACEMENT_START, { ...frame, target: -200, scrollTop: 300 }).scrollTo).toBe(0);
    expect(placementStep(PLACEMENT_START, { ...frame, target: -200, scrollTop: 0 }).scrollTo).toBeNull();
  });
});
