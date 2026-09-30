import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isTextEntry } from './textEntry';

/** Just enough of a DOM element: its tag and whether it is editable. */
class FakeElement {
  constructor(
    readonly tagName: string,
    readonly isContentEditable = false,
  ) {}
}

beforeEach(() => vi.stubGlobal('HTMLElement', FakeElement));
afterEach(() => vi.unstubAllGlobals());

describe('isTextEntry', () => {
  it('is a text field, a select or editable text', () => {
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) expect(isTextEntry(new FakeElement(tag))).toBe(true);
    expect(isTextEntry(new FakeElement('DIV', true))).toBe(true);
  });

  it('is not a list, a button, the window or nothing', () => {
    expect(isTextEntry(new FakeElement('DIV'))).toBe(false);
    expect(isTextEntry(new FakeElement('BUTTON'))).toBe(false);
    expect(isTextEntry({ tagName: 'INPUT' })).toBe(false);
    expect(isTextEntry(null)).toBe(false);
  });
});
