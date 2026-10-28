import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { PressedKey } from '../../lib/shortcuts';
import { focusModeButton, focusModeKey, focusModeLayout, layoutAfterFocus, offersFocusMode } from './focusMode';

function press(key: string, code: string, modifiers: Partial<PressedKey> = {}): PressedKey {
  return { key, code, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...modifiers };
}

const toggleKey = press('f', 'KeyF', { metaKey: true, shiftKey: true });

describe('offersFocusMode', () => {
  it('offers the larger editor to a comment of many lines, never to a one-line field', () => {
    expect(offersFocusMode(false)).toBe(true);
    expect(offersFocusMode(true)).toBe(false);
  });
});

describe('focusModeKey', () => {
  it('goes into the larger editor and back with the same key', () => {
    expect(focusModeKey(toggleKey, true, { expanded: false, suggesting: false })).toBe('toggle');
    expect(focusModeKey(toggleKey, true, { expanded: true, suggesting: false })).toBe('toggle');
  });

  it('takes Ctrl off macOS', () => {
    expect(focusModeKey(press('f', 'KeyF', { ctrlKey: true, shiftKey: true }), false, { expanded: false, suggesting: false })).toBe('toggle');
  });

  it('goes back with Esc, once the suggestions are closed', () => {
    expect(focusModeKey(press('Escape', 'Escape'), true, { expanded: true, suggesting: false })).toBe('collapse');
    expect(focusModeKey(press('Escape', 'Escape'), true, { expanded: true, suggesting: true })).toBeNull();
    expect(focusModeKey(press('Escape', 'Escape'), true, { expanded: false, suggesting: false })).toBeNull();
  });

  it('leaves every other key to the text', () => {
    expect(focusModeKey(press('f', 'KeyF'), true, { expanded: true, suggesting: false })).toBeNull();
  });
});

describe('focusModeLayout', () => {
  it('opens over the view, and grows in place in a dialog, which keeps its clicks and focus', () => {
    expect(focusModeLayout(false)).toBe('overlay');
    expect(focusModeLayout(true)).toBe('inPlace');
  });
});

describe('layoutAfterFocus', () => {
  it('leaves the larger editor once the focus leaves it (a dialog it opened, Tab), and keeps it while focused', () => {
    expect(layoutAfterFocus('overlay', false)).toBeNull();
    expect(layoutAfterFocus('inPlace', false)).toBeNull();
    expect(layoutAfterFocus('overlay', true)).toBe('overlay');
    expect(layoutAfterFocus(null, true)).toBeNull();
  });
});

describe('focusModeButton', () => {
  it('names what it does, and says whether the larger editor is open', () => {
    expect(focusModeButton(null)).toEqual({ label: 'Write in a larger editor', icon: 'expand', pressed: false });
    expect(focusModeButton('overlay')).toEqual({ label: 'Back to the field', icon: 'collapse', pressed: true });
  });
});
