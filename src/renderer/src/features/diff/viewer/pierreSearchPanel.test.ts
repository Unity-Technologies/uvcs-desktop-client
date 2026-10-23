import '../../../testing/fakeWindow';
import { resolveEditorCommandFromKeyboardEvent } from '@pierre/diffs/edit';
import { describe, expect, it } from 'vitest';
import { pierreEditorKeymap, pierreReadsMac, pierreShortcut, searchPanelKey } from './pierreSearchPanel';

/** The command Pierre's editor runs for the key that opens the search panel, on macOS or elsewhere. */
function commandOf(mode: 'find' | 'replace', mac: boolean, pierreMac = mac): string | undefined {
  return resolveEditorCommandFromKeyboardEvent(searchPanelKey(mode, mac, pierreMac) as KeyboardEvent, pierreEditorKeymap(mac), pierreMac);
}

describe('the search panel', () => {
  it.each([true, false])('opens to find from the key the menu presses (macOS: %s)', (mac) => {
    expect(commandOf('find', mac)).toBe('openSearchPanel');
  });

  it.each([true, false])('opens to replace from the key the menu presses (macOS: %s)', (mac) => {
    expect(commandOf('replace', mac)).toBe('openSearchReplacePanel');
  });

  it('opens to replace with ⌥⌘F on macOS and Ctrl+H elsewhere, the keys the registry shows', () => {
    expect(searchPanelKey('replace', true, true)).toMatchObject({ key: 'f', metaKey: true, altKey: true, ctrlKey: false });
    expect(searchPanelKey('replace', false, false)).toMatchObject({ key: 'h', ctrlKey: true, altKey: false, metaKey: false });
  });

  it("keeps Pierre's own keys working beside the app's", () => {
    const ctrlAltF = { key: 'f', code: 'KeyF', ctrlKey: true, altKey: true, metaKey: false, shiftKey: false } as KeyboardEvent;
    expect(resolveEditorCommandFromKeyboardEvent(ctrlAltF, pierreEditorKeymap(false), false)).toBe('openSearchReplacePanel');
  });
});

describe('a Mac previewing another OS', () => {
  it("opens Replace from the menu with the key it shows, held as Pierre, which still reads the Mac, takes it", () => {
    expect(commandOf('replace', false, true)).toBe('openSearchReplacePanel');
    expect(commandOf('find', false, true)).toBe('openSearchPanel');
  });

  it("reads the platform as Pierre does", () => {
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
