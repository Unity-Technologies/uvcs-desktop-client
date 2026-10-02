import { navigationTarget } from '../../lib/listNavigation';
import { hotkeys } from '../../lib/shortcutRegistry';
import { matchesShortcut, type PressedKey } from '../../lib/shortcuts';
import { segmentAfterKey } from '../../ui/segmentKeys';
import type { OwnState } from './aclResolution';

/** The states of a permission in the order its control shows them. */
export const OWN_STATES: readonly OwnState[] = ['inherit', 'allow', 'deny'];

export type GridKeyAction = { kind: 'move'; index: number } | { kind: 'set'; state: OwnState } | { kind: 'menu' } | null;

const matchesAny = (event: PressedKey, id: Parameters<typeof hotkeys>[0]) => hotkeys(id).some((key) => matchesShortcut(event, key));

/**
 * What a key does in the permission grid, one Tab stop for every row: ↑ ↓ (and Page Up, Page Down, Home, End) move
 * between permissions, ← → step through inherit, allow and deny, A, D and I pick one, Shift+F10 opens the active
 * permission's overrides menu. Null for any other key.
 */
export function gridKeyAction(event: PressedKey, current: number, count: number, state: OwnState | undefined): GridKeyAction {
  if (count === 0) return null;
  if (matchesAny(event, 'permissionMenu')) return { kind: 'menu' };
  if (matchesAny(event, 'permissionAllow')) return { kind: 'set', state: 'allow' };
  if (matchesAny(event, 'permissionDeny')) return { kind: 'set', state: 'deny' };
  if (matchesAny(event, 'permissionInherit')) return { kind: 'set', state: 'inherit' };
  if (state && matchesAny(event, 'permissionStep')) {
    const next = segmentAfterKey(OWN_STATES, state, event.key);
    return next ? { kind: 'set', state: next } : null;
  }
  if (event.metaKey || event.ctrlKey || event.altKey) return null;
  if (event.key === 'Home') return { kind: 'move', index: 0 };
  if (event.key === 'End') return { kind: 'move', index: count - 1 };
  const index = navigationTarget(event.key, current, count);
  return index === null ? null : { kind: 'move', index };
}
