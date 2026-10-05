import { describe, expect, it } from 'vitest';
import { attachesEditor, heldModifiedText } from './editorAttachment';

describe('attachesEditor', () => {
  const shown = {};

  it('attaches the editor to an editable diff highlighted before it shows', () => {
    expect(attachesEditor({ editable: true, highlighting: 'inline', readyFor: null, shown })).toBe(true);
    expect(attachesEditor({ editable: true, highlighting: 'off', readyFor: null, shown })).toBe(true);
  });

  it('attaches it to one highlighted in the background once that diff is highlighted', () => {
    expect(attachesEditor({ editable: true, highlighting: 'background', readyFor: null, shown })).toBe(false);
    expect(attachesEditor({ editable: true, highlighting: 'background', readyFor: {}, shown })).toBe(false);
    expect(attachesEditor({ editable: true, highlighting: 'background', readyFor: shown, shown })).toBe(true);
  });

  it('never attaches it to a read-only diff', () => {
    expect(attachesEditor({ editable: false, highlighting: 'inline', readyFor: shown, shown })).toBe(false);
  });
});

describe('heldModifiedText', () => {
  it('is the modified text as read', () => {
    expect(heldModifiedText(undefined, 'a')).toBe('a');
    expect(heldModifiedText({ modified: 'a', held: 'a', current: 'a' }, 'a')).toBe('a');
  });

  it('holds the text the diff was shown from when the text read is what the editor already held: a save', () => {
    expect(heldModifiedText({ modified: 'a', held: 'a', current: 'ab' }, 'ab')).toBe('a');
  });

  it('takes a text read that the editor did not hold: the file changed on disk, or a discard wrote it', () => {
    expect(heldModifiedText({ modified: 'a', held: 'a', current: 'a' }, 'b')).toBe('b');
    expect(heldModifiedText({ modified: 'a', held: 'a', current: 'ab' }, 'abc')).toBe('abc');
  });
});
