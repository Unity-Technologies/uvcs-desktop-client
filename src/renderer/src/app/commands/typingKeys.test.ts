import { describe, expect, it } from 'vitest';
import { belongsToField } from './typingKeys';

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
});
