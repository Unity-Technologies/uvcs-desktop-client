import type { KeyboardEvent } from 'react';
import { hotkeys } from './shortcutRegistry';
import { matchesShortcut } from './shortcuts';

/**
 * In a list driven from its filter field (the palette, the branch and workspace pickers, Go to file), the keys that
 * open the highlighted row's actions: Tab, as in the palette, or Shift+F10. Tab moves focus as usual elsewhere.
 */
export function isRowMenuKey(event: KeyboardEvent): boolean {
  return event.key === 'ContextMenu' || hotkeys('rowActions').some((key) => matchesShortcut(event.nativeEvent, key));
}

/** The keys that open a list's context menu at its focused row: the context-menu key, or Shift+F10 (Windows, Linux). */
export function isListMenuKey(event: KeyboardEvent): boolean {
  return event.key === 'ContextMenu' || hotkeys('listContextMenu').some((key) => matchesShortcut(event.nativeEvent, key));
}

/** Opens an element's context menu from the keyboard, where a right click on it would. */
export function openContextMenuOf(element: HTMLElement | null): void {
  if (!element) return;
  const bounds = element.getBoundingClientRect();
  element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: bounds.left + 24, clientY: bounds.bottom - 4 }));
}
