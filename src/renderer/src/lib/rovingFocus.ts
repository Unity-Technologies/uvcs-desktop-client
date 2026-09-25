import type { KeyboardEvent } from 'react';
import { navigationTarget } from './listNavigation';

/** Marks the elements of a list that ↑/↓ move focus between (spread it on each row's button). */
export const ROVING_ITEM = { 'data-roving-item': '' } as const;

function items(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-roving-item]')];
}

export function focusFirstItem(container: HTMLElement | null): boolean {
  const first = container && items(container)[0];
  first?.focus();
  return Boolean(first);
}

/**
 * ↑/↓, PageUp/PageDown, Home/End move focus between the list's rows (`ROVING_ITEM`); ↑ on the first row calls
 * `onLeaveTop` (e.g. back to the filter field above the list).
 */
export function moveRovingFocus(container: HTMLElement, event: KeyboardEvent, onLeaveTop?: () => void): void {
  const rows = items(container);
  const current = rows.findIndex((row) => row.contains(document.activeElement));
  if (current === -1 || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key === 'ArrowUp' && current === 0 && onLeaveTop) {
    event.preventDefault();
    onLeaveTop();
    return;
  }
  const ends: Record<string, number> = { Home: 0, End: rows.length - 1 };
  const target = ends[event.key] ?? navigationTarget(event.key, current, rows.length);
  if (target === null || target === undefined) return;
  event.preventDefault();
  rows[target]!.focus();
  rows[target]!.scrollIntoView({ block: 'nearest' });
}
