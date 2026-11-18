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

/** An open dialog, holding the elements given. */
function dialogHolding(...elements: FakeElement[]): { contains: (element: FakeElement) => boolean } {
  return { contains: (element) => elements.includes(element) };
}

/** The page as the menu closes: what has focus, and the dialogs open. */
function page({ activeElement = null as FakeElement | null, dialogs = [] as ReturnType<typeof dialogHolding>[] } = {}): void {
  vi.stubGlobal('document', { activeElement, querySelectorAll: () => dialogs });
}

/** What the menu does with focus as it closes: keeps it where it is, or gives it back (to its trigger, or `otherwise`). */
function closeMenu(opener?: FakeElement): 'kept' | 'givenBack' {
  const event = new Event('focusScope.autoFocusOnUnmount', { cancelable: true });
  let givenBack = false;
  focusAfterMenu(event, () => (givenBack = true), opener as unknown as Element | undefined);
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
    page({ dialogs: [dialogHolding()] });
    expect(closeMenu()).toBe('kept');
    expect(closeMenu(new FakeElement('BUTTON'))).toBe('kept');
  });

  it('gives it back in the dialog the menu opened in (a result of Go to file: back to its filter)', () => {
    const trigger = new FakeElement('BUTTON');
    page({ dialogs: [dialogHolding(trigger)] });
    expect(closeMenu(trigger)).toBe('givenBack');
  });

  it('leaves it in a dialog the action opened over the one the menu opened in', () => {
    const trigger = new FakeElement('BUTTON');
    page({ dialogs: [dialogHolding(trigger), dialogHolding()] });
    expect(closeMenu(trigger)).toBe('kept');
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
