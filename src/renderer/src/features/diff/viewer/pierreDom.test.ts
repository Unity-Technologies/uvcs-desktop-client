import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { changedLineType, editorHasFocusIn, lineRowSelector, numberCellSelector, pageTextSelection } from './pierreDom';

describe('pierreDom', () => {
  it('names a changed line by its type in Pierre’s rows', () => {
    expect(changedLineType({ side: 'additions' })).toBe('change-addition');
    expect(changedLineType({ side: 'deletions' })).toBe('change-deletion');
  });

  it('selects a changed line’s content row and its number cell', () => {
    expect(lineRowSelector({ side: 'deletions', lineNumber: 3 })).toBe('[data-line-type="change-deletion"][data-line="3"]');
    expect(numberCellSelector({ side: 'additions', lineNumber: 12 })).toBe('[data-line-type="change-addition"][data-column-number="12"]');
  });
});

/**
 * Just enough of Pierre's shadow DOM to read a selection from: elements with attributes and children, text nodes, an
 * open shadow root with `getSelection`, and `document.createRange` measuring the text before a point in a row.
 */
class FakeNode {
  parentElement: FakeElement | null = null;
}

class FakeText extends FakeNode {
  constructor(readonly textContent: string) {
    super();
  }
}

class FakeElement extends FakeNode {
  readonly children: FakeNode[] = [];
  isContentEditable = false;
  shadowRoot: FakeShadowRoot | null = null;
  constructor(
    readonly tagName: string,
    private readonly attributes: Record<string, string> = {},
    children: (FakeNode | string)[] = [],
  ) {
    super();
    for (const child of children) this.append(typeof child === 'string' ? new FakeText(child) : child);
  }
  append(child: FakeNode): void {
    child.parentElement = this;
    this.children.push(child);
  }
  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }
  hasAttribute(name: string): boolean {
    return name in this.attributes;
  }
  /** Selectors of attributes alone, as the code asks for them: `[data-line]`, `[data-deletions], [data-additions]`. */
  closest(selector: string): FakeElement | null {
    const names = selector.split(',').map((part) => part.trim().slice(1, -1));
    for (let element: FakeElement | null = this; element; element = element.parentElement) if (names.some((name) => element!.hasAttribute(name))) return element;
    return null;
  }
  querySelector(tag: string): FakeElement | null {
    for (const child of this.children) {
      if (!(child instanceof FakeElement)) continue;
      if (child.tagName === tag) return child;
      const found = child.querySelector(tag);
      if (found) return found;
    }
    return null;
  }
  contains(node: FakeNode): boolean {
    for (let at: FakeNode | null = node; at; at = at.parentElement) if (at === this) return true;
    return false;
  }
}

class FakeShadowRoot extends FakeElement {
  activeElement: FakeElement | null = null;
  selection: Partial<Selection> | null = null;
  getSelection(): Partial<Selection> | null {
    return this.selection;
  }
}

/** The text of `element`'s nodes, in order, up to `node` at `offset` (a text's characters, an element's children). */
function textBefore(element: FakeElement, node: FakeNode, offset: number): { text: string; found: boolean } {
  let text = '';
  for (const [index, child] of element.children.entries()) {
    if (child === node && child instanceof FakeText) return { text: text + child.textContent.slice(0, offset), found: true };
    if (element === node && index === offset) return { text, found: true };
    if (child instanceof FakeText) text += child.textContent;
    else if (child instanceof FakeElement) {
      const inner = textBefore(child, node, offset);
      text += inner.text;
      if (inner.found) return { text, found: true };
    }
  }
  return { text, found: element === node };
}

function fakeRange() {
  let start: FakeElement | null = null;
  let end: { node: FakeNode; offset: number } | null = null;
  return {
    setStart: (node: FakeElement) => void (start = node),
    setEnd: (node: FakeNode, offset: number) => void (end = { node, offset }),
    toString: () => textBefore(start!, end!.node, end!.offset).text,
  };
}

/** A row of code as Pierre draws one: its line, its type, its text in token spans. */
const row = (line: number, type: string, ...tokens: string[]): FakeElement =>
  new FakeElement('DIV', { 'data-line': String(line), 'data-line-type': type }, tokens.map((token) => new FakeElement('SPAN', {}, [token])));

/** A diff in `container`: its shadow root holds `panes`, selected from `anchor` to `focus`. */
function diffWith(panes: FakeElement[], anchor: [FakeNode, number], focus: [FakeNode, number], text = 'selected') {
  const root = new FakeShadowRoot('#shadow-root', {}, panes);
  root.selection = { isCollapsed: false, anchorNode: anchor[0] as never, anchorOffset: anchor[1], focusNode: focus[0] as never, focusOffset: focus[1], toString: () => text };
  const host = new FakeElement('diffs-container');
  host.shadowRoot = root;
  return new FakeElement('DIV', {}, [host]) as unknown as Element;
}

/** The first text node of a row's `index`th token. */
const tokenText = (element: FakeElement, index: number): FakeText => (element.children[index] as FakeElement).children[0] as FakeText;

describe('pageTextSelection', () => {
  beforeEach(() => {
    vi.stubGlobal('Element', FakeElement);
    vi.stubGlobal('document', { createRange: fakeRange });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reads a selection on one side, side by side, as its lines and characters in that side's text", () => {
    const first = row(4, 'context', 'const ', 'a', ' = 1;');
    const second = row(5, 'change-addition', 'let ', 'b;');
    const additions = new FakeElement('DIV', { 'data-additions': '' }, [first, second]);
    const container = diffWith([new FakeElement('DIV', { 'data-deletions': '' }), additions], [tokenText(first, 1), 0], [tokenText(second, 1), 1]);
    expect(pageTextSelection(container)).toEqual({ text: 'selected', place: { side: 'additions', span: { start: { line: 3, character: 6 }, end: { line: 4, character: 5 } } } });
  });

  it('reads a removed row of a unified diff as the older side', () => {
    const removed = row(9, 'change-deletion', 'old();');
    const container = diffWith([new FakeElement('DIV', {}, [removed])], [tokenText(removed, 0), 1], [tokenText(removed, 0), 4]);
    expect(pageTextSelection(container)?.place).toEqual({ side: 'deletions', span: { start: { line: 8, character: 1 }, end: { line: 8, character: 4 } } });
  });

  it('keeps a selection dragged backwards as it was dragged, its focus before its anchor', () => {
    const line = row(2, 'context', 'abcdef');
    const container = diffWith([new FakeElement('DIV', { 'data-additions': '' }, [line])], [tokenText(line, 0), 5], [tokenText(line, 0), 1]);
    expect(pageTextSelection(container)?.place?.span).toEqual({ start: { line: 1, character: 5 }, end: { line: 1, character: 1 } });
  });

  it('has no place for a selection across both sides of a unified diff', () => {
    const removed = row(3, 'change-deletion', 'old');
    const added = row(3, 'change-addition', 'new');
    const container = diffWith([new FakeElement('DIV', {}, [removed, added])], [tokenText(removed, 0), 0], [tokenText(added, 0), 2], 'old\nne');
    expect(pageTextSelection(container)).toEqual({ text: 'old\nne', place: null });
  });

  it('has no place for a selection ending on a line number, which is no row of code', () => {
    const line = row(2, 'context', 'abc');
    const number = new FakeElement('DIV', { 'data-column-number': '3' }, ['3']);
    const container = diffWith([new FakeElement('DIV', { 'data-additions': '' }, [line, number])], [tokenText(line, 0), 1], [number.children[0]!, 1]);
    expect(pageTextSelection(container)?.place).toBeNull();
  });

  it('is none when nothing is selected', () => {
    const line = row(2, 'context', 'abc');
    const container = diffWith([new FakeElement('DIV', { 'data-additions': '' }, [line])], [tokenText(line, 0), 1], [tokenText(line, 0), 1], '');
    expect(pageTextSelection(container)).toBeNull();
  });
});

describe('editorHasFocusIn', () => {
  beforeEach(() => vi.stubGlobal('HTMLElement', FakeElement));
  afterEach(() => vi.unstubAllGlobals());

  /** A diff whose shadow root has `focused` in focus, inside `panel` when given (Pierre's search panel). */
  function focusedIn(focused: FakeElement | null, panel?: FakeElement): Element {
    const root = new FakeShadowRoot('#shadow-root', {}, panel ? [panel] : focused ? [focused] : []);
    root.activeElement = focused;
    const host = new FakeElement('diffs-container');
    host.shadowRoot = root;
    return new FakeElement('DIV', {}, [host]) as unknown as Element;
  }

  it("is the editor's text, typed into", () => {
    const content = new FakeElement('DIV');
    content.isContentEditable = true;
    expect(editorHasFocusIn(focusedIn(content))).toBe(true);
  });

  it("is the editor's search box too, whose keys are the editor's", () => {
    const input = new FakeElement('INPUT');
    expect(editorHasFocusIn(focusedIn(input, new FakeElement('DIV', { 'data-search-panel': '' }, [input])))).toBe(true);
  });

  it('is nothing else in the diff, nor a diff without focus', () => {
    expect(editorHasFocusIn(focusedIn(new FakeElement('BUTTON')))).toBe(false);
    expect(editorHasFocusIn(focusedIn(null))).toBe(false);
  });
});
