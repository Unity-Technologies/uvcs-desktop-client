import { beforeAll, describe, expect, it, vi } from 'vitest';

let belongsToField: typeof import('./typingKeys').belongsToField;

beforeAll(async () => {
  vi.stubGlobal('window', { uvcs: { platform: 'darwin' } });
  ({ belongsToField } = await import('./typingKeys'));
});

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
