import { describe, expect, it } from 'vitest';
import { focusWithoutRing, POINTER_FOCUS_ATTRIBUTE } from './usePointerFocusMark';

/** A pane that records its attributes, its focus and what it was focused with, and fires its blur listeners. */
function fakePane() {
  const attributes = new Set<string>();
  const blurListeners: (() => void)[] = [];
  const focused: { options: FocusOptions | undefined; marked: boolean }[] = [];
  return {
    attributes,
    focused,
    setAttribute: (name: string) => void attributes.add(name),
    removeAttribute: (name: string) => void attributes.delete(name),
    focus: (options?: FocusOptions) => void focused.push({ options, marked: attributes.has(POINTER_FOCUS_ATTRIBUTE) }),
    addEventListener: (type: string, listener: () => void) => void (type === 'blur' && blurListeners.push(listener)),
    blur: () => blurListeners.splice(0).forEach((listener) => listener()),
  };
}

describe('focusWithoutRing', () => {
  it('gives the pane focus already marked, so its keyboard ring stays off, without scrolling it', () => {
    const pane = fakePane();
    focusWithoutRing(pane as never);
    expect(pane.focused).toEqual([{ options: { preventScroll: true }, marked: true }]);
  });

  it('drops the mark once focus leaves, so a Tab back into the pane rings it', () => {
    const pane = fakePane();
    focusWithoutRing(pane as never);
    pane.blur();
    expect(pane.attributes.has(POINTER_FOCUS_ATTRIBUTE)).toBe(false);
  });
});
