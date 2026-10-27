import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { focusAfterMenu } from './focusAfterMenu';

/** Just enough of a DOM element: its tag, whether it is in the page, editable, and the shadow root it hosts. */
class FakeElement {
  shadowRoot: { activeElement: FakeElement | null } | null = null;
  constructor(
    readonly tagName: string,
    readonly isConnected = true,
    readonly isContentEditable = false,
  ) {}
}

/** An element hosting an open shadow root, with `inside` focused in it, as Pierre's `diffs-container` holds its editor. */
function hostOf(inside: FakeElement): FakeElement {
  const host = new FakeElement('DIFFS-CONTAINER');
  host.shadowRoot = { activeElement: inside };
  return host;
}

/** The page as the menu closes: what has focus, and whether a dialog is open. */
function page({ activeElement = null as FakeElement | null, dialogOpen = false } = {}): void {
  vi.stubGlobal('document', { activeElement, querySelector: () => (dialogOpen ? {} : null) });
}

/** What the menu does with focus as it closes: keeps it where it is, or gives it back (to its trigger, or `otherwise`). */
function closeMenu(): 'kept' | 'givenBack' {
  const event = new Event('focusScope.autoFocusOnUnmount', { cancelable: true });
  let givenBack = false;
  focusAfterMenu(event, () => (givenBack = true));
  return event.defaultPrevented || !givenBack ? 'kept' : 'givenBack';
}

beforeEach(() => vi.stubGlobal('HTMLElement', FakeElement));
afterEach(() => vi.unstubAllGlobals());

describe('focusAfterMenu', () => {
  it('gives focus back once an action that took it nowhere closes the menu', () => {
    page();
    expect(closeMenu()).toBe('givenBack');
  });

  it('leaves it in a dialog the action opened', () => {
    page({ dialogOpen: true });
    expect(closeMenu()).toBe('kept');
  });

  it('leaves the caret in the field the action put it in ("Check in this changelist": the comment)', () => {
    page({ activeElement: new FakeElement('INPUT') });
    expect(closeMenu()).toBe('kept');
  });

  it('gives focus back when what has it is no field, or a field gone with its popover', () => {
    page({ activeElement: new FakeElement('BUTTON') });
    expect(closeMenu()).toBe('givenBack');
    page({ activeElement: new FakeElement('INPUT', false) });
    expect(closeMenu()).toBe('givenBack');
  });

  it("leaves the caret in a field inside a shadow root (Pierre's editor), whose host is all the document names", () => {
    page({ activeElement: hostOf(new FakeElement('DIV', true, true)) });
    expect(closeMenu()).toBe('kept');
    page({ activeElement: hostOf(hostOf(new FakeElement('INPUT'))) });
    expect(closeMenu()).toBe('kept');
  });

  it('gives focus back from a shadow root whose focus is on no field', () => {
    page({ activeElement: hostOf(new FakeElement('BUTTON')) });
    expect(closeMenu()).toBe('givenBack');
  });
});
