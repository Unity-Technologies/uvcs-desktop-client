import { describe, expect, it } from 'vitest';
import { clickedWith, focusAs, showsFocusRing } from './focusRing';

/** An element that records how it was focused and blurred. */
function element() {
  const calls: unknown[] = [];
  return {
    calls,
    focus: (options?: FocusOptions) => void calls.push(['focus', options]),
    blur: () => void calls.push(['blur']),
  };
}

describe('showsFocusRing', () => {
  it('rings what the keyboard moved focus to (Tab, Enter on a button)', () => {
    expect(showsFocusRing('keyboard')).toBe(true);
  });

  it('rings neither what the app moves focus to on its own (Expand Diff giving the code the keyboard) nor what a click focused', () => {
    expect(showsFocusRing('app')).toBe(false);
    expect(showsFocusRing('pointer')).toBe(false);
  });
});

describe('clickedWith', () => {
  it('reads a click with no pointer presses as the keyboard: Enter or Space on the button', () => {
    expect(clickedWith(0)).toBe('keyboard');
  });

  it('reads a click as the pointer', () => {
    expect(clickedWith(1)).toBe('pointer');
    expect(clickedWith(2)).toBe('pointer');
  });
});

describe('focusAs', () => {
  it('focuses without a ring when the app moves focus, so the keys pressed next show none until a Tab', () => {
    const code = element();
    focusAs(code, 'app', null);
    expect(code.calls).toEqual([['focus', { preventScroll: true, focusVisible: false }]]);
  });

  it('focuses a clicked button again without a ring, blurring it first: Chromium would ring it at the next key', () => {
    const button = element();
    focusAs(button, 'pointer', button);
    expect(button.calls).toEqual([['blur'], ['focus', { preventScroll: true, focusVisible: false }]]);
  });

  it('leaves the ring to Chromium when the keyboard moves focus', () => {
    const list = element();
    focusAs(list, 'keyboard', null);
    expect(list.calls).toEqual([['focus', { preventScroll: true }]]);
  });
});
