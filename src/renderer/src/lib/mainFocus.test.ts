import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { focusMain, focusMainNear, isKeyboardTaken } from './mainFocus';

/** Just enough of a DOM element for the focus rules: its tag, whether it is editable, its shadow root, its children. */
class FakeElement {
  focused = 0;
  shadowRoot: { activeElement: FakeElement | null } | null = null;
  constructor(
    readonly tagName: string,
    readonly options: { editable?: boolean; visible?: boolean; children?: FakeElement[] } = {},
  ) {}
  get isContentEditable() {
    return this.options.editable ?? false;
  }
  checkVisibility() {
    return this.options.visible ?? true;
  }
  contains(other: unknown): boolean {
    return other === this || (this.options.children ?? []).some((child) => child.contains(other));
  }
  focus() {
    this.focused++;
    Object.assign(document, { activeElement: this });
  }
}

/** The page: what has focus, and the popups open over it (by role). */
function page({ active = null, popups = [] }: { active?: FakeElement | null; popups?: string[] } = {}) {
  vi.stubGlobal('document', {
    activeElement: active,
    querySelector: (selector: string) => (popups.some((role) => selector.includes(role)) ? {} : null),
  });
}

/** A view whose elements carrying `MAIN_FOCUS` are these. */
const view = (...mainElements: FakeElement[]) => ({ querySelectorAll: () => mainElements }) as unknown as ParentNode;

beforeEach(() => vi.stubGlobal('HTMLElement', FakeElement));
afterEach(() => vi.unstubAllGlobals());

describe('isKeyboardTaken', () => {
  it('is free while nothing or a list has focus', () => {
    page();
    expect(isKeyboardTaken()).toBe(false);

    page({ active: new FakeElement('DIV') });
    expect(isKeyboardTaken()).toBe(false);
  });

  it('is taken by a text field, a select or editable text', () => {
    for (const field of [new FakeElement('INPUT'), new FakeElement('TEXTAREA'), new FakeElement('SELECT'), new FakeElement('DIV', { editable: true })]) {
      page({ active: field });
      expect(isKeyboardTaken()).toBe(true);
    }
  });

  it('is taken by a text field inside a shadow root, as the diff’s editor is', () => {
    const host = new FakeElement('DIFFS-CONTAINER');
    host.shadowRoot = { activeElement: new FakeElement('DIV', { editable: true }) };
    page({ active: host });

    expect(isKeyboardTaken()).toBe(true);
  });

  it('is taken while a dialog, a menu or a popover is open', () => {
    for (const popup of ['role="dialog"', 'role="alertdialog"', 'role="menu"', 'data-radix-popper-content-wrapper']) {
      page({ popups: [popup] });
      expect(isKeyboardTaken()).toBe(true);
    }
  });
});

describe('focusMain', () => {
  it('focuses the first main element on screen', () => {
    page();
    const hidden = new FakeElement('DIV', { visible: false });
    const list = new FakeElement('DIV');

    expect(focusMain(view(hidden, list))).toBe(true);
    expect([hidden.focused, list.focused]).toEqual([0, 1]);
  });

  it('leaves focus where it is inside the main element, on its focused row', () => {
    const row = new FakeElement('DIV');
    const list = new FakeElement('DIV', { children: [row] });
    page({ active: row });

    expect(focusMain(view(list))).toBe(true);
    expect(list.focused).toBe(0);
  });

  it('says so when the view has nothing to focus yet, still loading', () => {
    page();

    expect(focusMain(view(new FakeElement('DIV', { visible: false })))).toBe(false);
  });
});

describe('focusMainNear', () => {
  /** An element under `parent` whose subtree holds these main elements. */
  const node = (parent: Element | null, ...mainElements: FakeElement[]) => ({ parentElement: parent, querySelectorAll: () => mainElements }) as unknown as Element;

  it('focuses the main element under the closest ancestor holding one, not one further up', () => {
    page();
    const changesets = new FakeElement('DIV');
    const files = new FakeElement('DIV');
    const column = node(null, changesets, files);
    const filesPane = node(column, files);
    const filterBar = node(filesPane);
    const field = node(filterBar);

    expect(focusMainNear(field)).toBe(true);
    expect([changesets.focused, files.focused]).toEqual([0, 1]);
  });

  it('says so when no ancestor holds a main element on screen', () => {
    page();
    const field = node(node(null, new FakeElement('DIV', { visible: false })));

    expect(focusMainNear(field)).toBe(false);
  });
});
