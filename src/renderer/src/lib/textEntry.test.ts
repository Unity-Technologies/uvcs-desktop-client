import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isTextEntry, keyTakenByText } from './textEntry';

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

describe('keyTakenByText', () => {
  it('is taken when typed in a text field or editable text', () => {
    expect(keyTakenByText({ defaultPrevented: false, target: new FakeElement('INPUT') as unknown as EventTarget })).toBe(true);
    expect(keyTakenByText({ defaultPrevented: false, target: new FakeElement('DIV', true) as unknown as EventTarget })).toBe(true);
  });

  it('is taken when something already handled it', () => {
    expect(keyTakenByText({ defaultPrevented: true, target: new FakeElement('DIV') as unknown as EventTarget })).toBe(true);
  });

  it('is free from a list or with nothing focused', () => {
    expect(keyTakenByText({ defaultPrevented: false, target: new FakeElement('DIV') as unknown as EventTarget })).toBe(false);
    expect(keyTakenByText({ defaultPrevented: false, target: null })).toBe(false);
  });
});
