import { describe, expect, it } from 'vitest';
import { editorRootOf } from './editorRoot';

/** A document or a shadow root, as `getRootNode` returns them: only who it is matters here. */
const root = (name: string) => ({ name }) as unknown as Document;

describe('editorRootOf', () => {
  it('is the document a field slotted into a shadow root lives in, not the shadow root its slot is in', () => {
    // A thread under a line of the diff: its card is the page's, shown through a slot of Pierre's shadow root. The
    // focus is the document's (`document.activeElement`), and the shadow root's `activeElement` stays null.
    const page = root('document');
    const parent = { getRootNode: () => page, assignedSlot: { getRootNode: () => root('pierre') } };
    expect(editorRootOf(parent)).toBe(page);
  });

  it('is the shadow root a field drawn inside one lives in', () => {
    const shadow = root('shadow');
    expect(editorRootOf({ getRootNode: () => shadow })).toBe(shadow);
  });
});
