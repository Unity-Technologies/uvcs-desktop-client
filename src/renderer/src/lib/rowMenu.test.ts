import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';

await vi.hoisted(async () => (await import('../testing/fakeWindow')).setPlatform('win32'));

import { holdBackMenuKeyRelease, isListMenuKey, isRowMenuKey } from './rowMenu';

/** A key press as React hands it to a list's handler. */
function press(key: string, modifiers: { shiftKey?: boolean } = {}): ReactKeyboardEvent & { defaultPrevented: boolean } {
  const nativeEvent = { key, code: '', shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, ...modifiers };
  const event = {
    ...nativeEvent,
    nativeEvent,
    defaultPrevented: false,
    preventDefault: () => void (event.defaultPrevented = true),
  };
  return event as unknown as ReactKeyboardEvent & { defaultPrevented: boolean };
}

describe('the keys that open a list row’s menu', () => {
  it('are the context-menu key and Shift+F10', () => {
    expect(isListMenuKey(press('ContextMenu'))).toBe(true);
    expect(isListMenuKey(press('F10', { shiftKey: true }))).toBe(true);
    expect(isListMenuKey(press('F10'))).toBe(false);
    expect(isListMenuKey(press('Tab'))).toBe(false);
  });

  it('add Tab in a list driven from its filter field, as in the palette', () => {
    expect(isRowMenuKey(press('Tab'))).toBe(true);
    expect(isRowMenuKey(press('F10', { shiftKey: true }))).toBe(true);
    expect(isRowMenuKey(press('ContextMenu'))).toBe(true);
    expect(isRowMenuKey(press('Tab', { shiftKey: true }))).toBe(false);
  });

  it('keep the context-menu key’s release from opening the menu a second time', () => {
    const release = press('ContextMenu');
    const otherRelease = press('F10', { shiftKey: true });

    holdBackMenuKeyRelease(release);
    holdBackMenuKeyRelease(otherRelease);

    expect([release.defaultPrevented, otherRelease.defaultPrevented]).toEqual([true, false]);
  });
});
