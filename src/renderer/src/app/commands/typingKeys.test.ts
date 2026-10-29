import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { belongsToField, copiesSelectedText, yieldsToCommentField } from './typingKeys';

const key = (key: string, modifiers: { metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean } = {}) => ({
  key,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  ...modifiers,
});

describe('belongsToField', () => {
  it('leaves plain keys to the field', () => {
    expect(belongsToField(key('n'))).toBe(true);
    expect(belongsToField(key('F2'))).toBe(true);
  });

  it('leaves deleting text to the field, whatever the modifiers', () => {
    expect(belongsToField(key('Backspace', { metaKey: true }))).toBe(true);
    expect(belongsToField(key('Backspace', { altKey: true }))).toBe(true);
    expect(belongsToField(key('Delete', { ctrlKey: true }))).toBe(true);
  });

  it('lets other chords reach their commands', () => {
    expect(belongsToField(key('k', { metaKey: true }))).toBe(false);
    expect(belongsToField(key('N', { metaKey: true }))).toBe(false);
  });

  it('leaves the text chords to the field: undo, clipboard, select all', () => {
    expect(belongsToField(key('z', { metaKey: true }), true)).toBe(true);
    expect(belongsToField(key('v', { ctrlKey: true }), false)).toBe(true);
    expect(belongsToField(key('A', { ctrlKey: true }), false)).toBe(true);
  });

  it('leaves Ctrl+Y to the field off macOS, where it redoes the typing, and ⌘Y to its command on macOS', () => {
    expect(belongsToField(key('y', { ctrlKey: true }), false)).toBe(true);
    expect(belongsToField(key('y', { metaKey: true }), true)).toBe(false);
  });

  it('takes the platform’s modifier for the text chords', () => {
    expect(belongsToField(key('z', { ctrlKey: true }), true)).toBe(false);
    expect(belongsToField(key('z', { metaKey: true }), false)).toBe(false);
  });
});

describe('copiesSelectedText', () => {
  const copy = (mac: boolean) => ({ ...key('c', mac ? { metaKey: true } : { ctrlKey: true }), shiftKey: false });

  it("leaves ⌘C and Ctrl+C to the page's copy while text is selected", () => {
    expect(copiesSelectedText(copy(true), 'cs:42', true)).toBe(true);
    expect(copiesSelectedText(copy(false), 'cs:42', false)).toBe(true);
  });

  it('lets them copy the selected row when no text is selected, and leaves other chords alone', () => {
    expect(copiesSelectedText(copy(true), '', true)).toBe(false);
    expect(copiesSelectedText({ ...copy(true), shiftKey: true }, 'cs:42', true)).toBe(false);
    expect(copiesSelectedText({ ...copy(true), key: 'x' }, 'cs:42', true)).toBe(false);
  });
});

describe('yieldsToCommentField', () => {
  const shiftCmd = (letter: string) => ({ key: letter, code: `Key${letter.toUpperCase()}`, metaKey: true, ctrlKey: false, altKey: false, shiftKey: true });

  it('leaves ⇧⌘U to a focused comment field, which makes a link: it never updates the workspace by surprise', () => {
    expect(yieldsToCommentField(shiftCmd('u'), true, true)).toBe(true);
    expect(yieldsToCommentField(shiftCmd('c'), true, true)).toBe(true);
  });

  it('runs the window’s ⇧⌘U (Update workspace) and ⇧⌘C (Copy link) everywhere else', () => {
    expect(yieldsToCommentField(shiftCmd('u'), false, true)).toBe(false);
    expect(yieldsToCommentField(shiftCmd('c'), false, true)).toBe(false);
  });

  it('runs ⌘K, the command palette, from a comment field too', () => {
    expect(yieldsToCommentField({ key: 'k', code: 'KeyK', metaKey: true, ctrlKey: false, altKey: false, shiftKey: false }, true, true)).toBe(false);
  });

  it('does the same off macOS with Ctrl', () => {
    const ctrlShift = { key: 'U', code: 'KeyU', metaKey: false, ctrlKey: true, altKey: false, shiftKey: true };
    expect(yieldsToCommentField(ctrlShift, true, false)).toBe(true);
    expect(yieldsToCommentField(ctrlShift, false, false)).toBe(false);
  });
});
