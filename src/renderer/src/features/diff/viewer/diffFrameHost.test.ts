import { describe, expect, it } from 'vitest';
import { headerTakesKeys, hostedNavigation } from './diffFrameHost';
import type { StepNavigation } from './useStepNavigation';

const navigation = (noun: string): StepNavigation => ({
  noun,
  shortcuts: { next: 'nextChange', previous: 'previousChange' },
  count: 0,
  current: null,
  goesTo: () => null,
  go: () => undefined,
  onViewScroll: () => undefined,
});

describe('hostedNavigation', () => {
  const header = navigation('header');

  it("shows the header's own file-to-file arrows while the diff loads, and gives them the keys", () => {
    expect(hostedNavigation(null, header)).toEqual({ navigation: header, stepsOwn: false });
    expect(headerTakesKeys(null)).toBe(true);
  });

  it("shows the loaded diff's navigation in the same arrows once it publishes one, the header's keys off", () => {
    const loaded = { navigation: navigation('loaded'), stepsOwn: true };
    expect(hostedNavigation(loaded, header)).toBe(loaded);
    expect(headerTakesKeys(loaded)).toBe(false);
  });

  it('keeps a loaded diff with no changes of its own (an image) on its own navigation, which steps files', () => {
    const image = { navigation: navigation('image'), stepsOwn: false };
    expect(hostedNavigation(image, header)).toBe(image);
    expect(headerTakesKeys(image)).toBe(false);
  });
});
