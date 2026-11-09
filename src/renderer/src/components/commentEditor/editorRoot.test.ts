import { describe, expect, it } from 'vitest';
import { editorRootOf } from './editorRoot';

/** A node as `getRootNode` returns it: only its kind (`nodeType`) and who it is matter here. */
const node = (name: string, nodeType: number, extra: object = {}) => ({ name, nodeType, ...extra }) as unknown as Node;
const page = node('document', 9) as Document;

describe('editorRootOf', () => {
  it('is the document a field slotted into a shadow root lives in, not the shadow root its slot is in', () => {
    // A thread under a line of the diff: its card is the page's, shown through a slot of Pierre's shadow root. The
    // focus is the document's (`document.activeElement`), and the shadow root's `activeElement` stays null.
    const parent = { getRootNode: () => page, assignedSlot: { getRootNode: () => node('pierre', 11, { host: {} }) } };
    expect(editorRootOf(parent, page)).toBe(page);
  });

  it('is the shadow root a field drawn inside one lives in', () => {
    const shadow = node('shadow', 11, { host: {} });
    expect(editorRootOf({ getRootNode: () => shadow }, page)).toBe(shadow);
  });

  it('is the document for a parent not yet in one, whose root is an element of its own', () => {
    expect(editorRootOf({ getRootNode: () => node('detached div', 1) }, page)).toBe(page);
  });
});
