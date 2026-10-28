import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { PressedKey } from '../../lib/shortcuts';
import { focusModeButton, focusModeKey, focusModeLayout, focusModeParts, layoutAfterFocus, offersFocusMode } from './focusMode';

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

  it('leaves the larger editor as ⌘↵ saves or checks in, the key going on to do it', () => {
    expect(focusModeKey(press('Enter', 'Enter', { metaKey: true }), true, { expanded: true, suggesting: false })).toBe('submitting');
    expect(focusModeKey(press('Enter', 'Enter', { metaKey: true }), true, { expanded: false, suggesting: false })).toBeNull();
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
  it('names what it does, the name alone telling whether the larger editor is open', () => {
    expect(focusModeButton(false)).toEqual({ label: 'Write in a larger editor', icon: 'expand' });
    expect(focusModeButton(true)).toEqual({ label: 'Back to the field', icon: 'collapse' });
  });
});

describe('focusModeParts', () => {
  const field = { singleLine: false, inGroup: false, groupOpen: false, ownLayout: null } as const;
  const none = { offered: false, layout: null, inFocusMode: false, button: null, toolbar: false, footer: false, backdrop: false, takesTab: false };

  it('gives a one-line field alone nothing', () => {
    expect(focusModeParts({ ...field, singleLine: true })).toEqual(none);
  });

  it('gives a comment of many lines its corner button, and in focus mode its toolbar, hints and Tab', () => {
    expect(focusModeParts(field)).toEqual({ ...none, offered: true, button: focusModeButton(false) });
    const expanded = { offered: true, inFocusMode: true, button: focusModeButton(true), toolbar: true, footer: true, takesTab: true };
    expect(focusModeParts({ ...field, ownLayout: 'overlay' })).toEqual({ ...none, ...expanded, layout: 'overlay', backdrop: true });
    expect(focusModeParts({ ...field, ownLayout: 'inPlace' })).toEqual({ ...none, ...expanded, layout: 'inPlace' });
  });

  it('gives the check-in’s summary the group’s keys only: no button, no toolbar, and Tab goes on to the description', () => {
    expect(focusModeParts({ ...field, singleLine: true, inGroup: true, groupOpen: true })).toEqual({ ...none, offered: true, inFocusMode: true });
  });

  it('gives the check-in’s description the button, the toolbar and Tab, the group drawing the panel and its hints', () => {
    expect(focusModeParts({ ...field, inGroup: true })).toEqual({ ...none, offered: true, button: focusModeButton(false) });
    expect(focusModeParts({ ...field, inGroup: true, groupOpen: true })).toEqual({ ...none, offered: true, inFocusMode: true, button: focusModeButton(true), toolbar: true, takesTab: true });
  });
});
