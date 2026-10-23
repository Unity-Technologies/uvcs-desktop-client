import { fakeApi } from '../../../testing/fakeWindow';
import { TextDocument } from '@pierre/diffs/edit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runEditorClipboard } from './editorClipboard';

const order: string[] = [];
const editor = { focus: () => void order.push('focus') };
// The test page has no `execCommand` of its own: one that does nothing, for the spy to watch.
Object.assign(document, { execCommand: (): boolean => true });

beforeEach(() => {
  vi.spyOn(document, 'execCommand').mockImplementation((command: string) => {
    order.push(command);
    return true;
  });
});

afterEach(() => {
  order.splice(0);
  vi.restoreAllMocks();
});

describe('runEditorClipboard', () => {
  it.each(['copy', 'cut'] as const)('runs the page\'s own %s on the editor, focused first, so Pierre handles it as the key would', (action) => {
    runEditorClipboard(action, editor);
    expect(order).toEqual(['focus', action]);
  });

  it('asks the window to paste into the focused editor, as the page may not', () => {
    fakeApi.answer('windows.pasteClipboard', () => undefined);
    runEditorClipboard('paste', editor);
    expect(fakeApi.calls()).toEqual([{ method: 'windows.pasteClipboard', args: [] }]);
    expect(order).toEqual(['focus']);
  });
});

describe("Pierre's paste", () => {
  // What makes the menu's Paste keep a CRLF file CRLF: Pierre's paste takes the document's line break, read from its
  // first one (`textDocument.js`), and `diskText` doesn't repair a line break typed in another one.
  it("takes the document's own line breaks, whatever the clipboard's", () => {
    expect(new TextDocument('file:///a.cs', 'one\r\ntwo\r\n').normalizeEol('x\ny\rz\r\n')).toBe('x\r\ny\r\nz\r\n');
    expect(new TextDocument('file:///a.cs', 'one\ntwo\n').normalizeEol('x\r\ny')).toBe('x\ny');
  });
});
