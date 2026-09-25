import { beforeAll, describe, expect, it, vi } from 'vitest';

let matchesShortcut: typeof import('./shortcuts').matchesShortcut;

beforeAll(async () => {
  vi.stubGlobal('window', { uvcs: { platform: 'darwin' } });
  ({ matchesShortcut } = await import('./shortcuts'));
});

function press(key: string, code: string, modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return { key, code, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...modifiers } as KeyboardEvent;
}

describe('matchesShortcut', () => {
  it('matches a symbol typed with Shift by its character', () => {
    expect(matchesShortcut(press('?', 'Slash', { shiftKey: true }), '?')).toBe(true);
    expect(matchesShortcut(press('/', 'Slash'), '?')).toBe(false);
  });

  it('matches ⌘/ without Shift', () => {
    expect(matchesShortcut(press('/', 'Slash', { metaKey: true }), 'mod+/')).toBe(true);
    expect(matchesShortcut(press('?', 'Slash', { metaKey: true, shiftKey: true }), 'mod+/')).toBe(false);
  });

  it('names the space bar', () => {
    expect(matchesShortcut(press(' ', 'Space'), 'space')).toBe(true);
  });

  it('reads digits by their key position, so Shift doesn’t change them', () => {
    expect(matchesShortcut(press('!', 'Digit1', { metaKey: true, shiftKey: true }), 'mod+shift+1')).toBe(true);
    expect(matchesShortcut(press('1', 'Digit1', { metaKey: true }), 'mod+shift+1')).toBe(false);
  });
});
