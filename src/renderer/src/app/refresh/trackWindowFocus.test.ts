import { focusManager } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

await vi.hoisted(async () => (await import('../../lib/testing/fakeWindow')).installFakeWindow());

import { trackWindowFocus } from './trackWindowFocus';

/** The window's state as the browser reports it, and the event it sends when it changes. */
function windowBecomes(state: { visible: boolean; focused: boolean }, event: 'focus' | 'blur' | 'visibilitychange') {
  Object.assign(document, { visibilityState: state.visible ? 'visible' : 'hidden', hasFocus: () => state.focused });
  (event === 'visibilitychange' ? document : window).dispatchEvent(new Event(event));
}

afterEach(() => windowBecomes({ visible: true, focused: true }, 'focus'));

describe('trackWindowFocus', () => {
  it('counts a window left for another app as away, though it stays visible, and coming back as a focus', () => {
    trackWindowFocus();

    windowBecomes({ visible: true, focused: false }, 'blur');
    expect(focusManager.isFocused()).toBe(false);

    windowBecomes({ visible: true, focused: true }, 'focus');
    expect(focusManager.isFocused()).toBe(true);
  });

  it('counts a hidden window as away', () => {
    trackWindowFocus();

    windowBecomes({ visible: false, focused: true }, 'visibilitychange');

    expect(focusManager.isFocused()).toBe(false);
  });
});
