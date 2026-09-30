import { describe, expect, it } from 'vitest';
import { isAimedAtMainList } from './mainFocusKeys';

const press = (key: string, modifiers: Partial<Record<'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey', boolean>> = {}) => ({
  key,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  ...modifiers,
});

describe('isAimedAtMainList', () => {
  it.each(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', 'Enter', ' ', 'j', 'k'])(
    'hands %j to the list',
    (key) => expect(isAimedAtMainList(press(key))).toBe(true),
  );

  it('hands Shift+arrows to the list, which extend its selection', () => {
    expect(isAimedAtMainList(press('ArrowDown', { shiftKey: true }))).toBe(true);
  });

  it('leaves chords to their shortcuts', () => {
    expect(isAimedAtMainList(press('ArrowDown', { metaKey: true }))).toBe(false);
    expect(isAimedAtMainList(press('k', { ctrlKey: true }))).toBe(false);
    expect(isAimedAtMainList(press('ArrowLeft', { altKey: true }))).toBe(false);
  });

  it('leaves other keys alone (a letter typed, Escape, Tab)', () => {
    expect(isAimedAtMainList(press('a'))).toBe(false);
    expect(isAimedAtMainList(press('Escape'))).toBe(false);
    expect(isAimedAtMainList(press('Tab'))).toBe(false);
  });
});
