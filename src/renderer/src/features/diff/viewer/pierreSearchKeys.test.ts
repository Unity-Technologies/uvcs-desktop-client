import '../../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { pierreReadsMac, pierreShortcut, searchKeyMode } from './pierreSearchKeys';

type Pressed = Partial<{ metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; isComposing: boolean; code: string }>;
const press = (key: string, modifiers: Pressed = {}) =>
  ({ key, code: `Key${key.toUpperCase()}`, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, isComposing: false, ...modifiers }) as KeyboardEvent;

describe('searchKeyMode', () => {
  it('opens Find with ⌘F on macOS and Ctrl+F elsewhere', () => {
    expect(searchKeyMode(press('f', { metaKey: true }), true, true)).toBe('find');
    expect(searchKeyMode(press('f', { ctrlKey: true }), false, false)).toBe('find');
  });

  it('opens Replace with ⌥⌘F on macOS and Ctrl+H elsewhere, the keys the registry shows', () => {
    expect(searchKeyMode(press('f', { metaKey: true, altKey: true }), true, true)).toBe('replace');
    expect(searchKeyMode(press('h', { ctrlKey: true }), false, false)).toBe('replace');
  });

  it("opens Replace with Pierre's own Ctrl+Alt+F too, so its editor never opens a search panel of its own", () => {
    expect(searchKeyMode(press('f', { ctrlKey: true, altKey: true }), false, false)).toBe('replace');
  });

  it('lets AltGr+F type its character on a layout where it types one ([ in Czech), though Pierre reads it as Ctrl+Alt+F', () => {
    expect(searchKeyMode(press('[', { code: 'KeyF', ctrlKey: true, altKey: true }), false, false)).toBe('type');
  });

  it('leaves a key typed while composing to the IME', () => {
    expect(searchKeyMode(press('f', { metaKey: true, isComposing: true }), true, true)).toBeNull();
  });

  it('leaves any other key to the code', () => {
    expect(searchKeyMode(press('f'), true, true)).toBeNull();
    expect(searchKeyMode(press('d', { metaKey: true }), true, true)).toBeNull();
  });

  it("reads the keys a Mac previewing another OS shows, held as Pierre, which still reads the Mac, takes them", () => {
    expect(searchKeyMode(press('h', { metaKey: true }), false, true)).toBe('replace');
    expect(searchKeyMode(press('f', { metaKey: true }), false, true)).toBe('find');
  });
});

describe('pierreReadsMac', () => {
  it('reads the platform as Pierre does', () => {
    expect(pierreReadsMac('MacIntel')).toBe(true);
    expect(pierreReadsMac('Win32')).toBe(false);
    expect(pierreReadsMac('Linux x86_64')).toBe(false);
  });
});

describe('pierreShortcut', () => {
  it("writes the registry's keys as Pierre's keymap does", () => {
    expect(pierreShortcut('mod+alt+f')).toBe('cmdOrCtrl+alt+f');
    expect(pierreShortcut('mod+h')).toBe('cmdOrCtrl+h');
    expect(pierreShortcut('ctrl+g')).toBe('ctrl+g');
  });
});
