import { isMac } from '../../../../lib/platform';
import { hotkeys, type ShortcutId } from '../../../../lib/shortcutRegistry';
import { matchesShortcut, type PressedKey } from '../../../../lib/shortcuts';
import type { FlyMove } from './orbitCamera';

/** Where a key held on the model stage moves the camera. */
export type FlyDirection = 'forward' | 'back' | 'left' | 'right' | 'up' | 'down';

const FLY_SHORTCUTS: [ShortcutId, FlyDirection][] = [
  ['modelFlyForward', 'forward'],
  ['modelFlyBack', 'back'],
  ['modelFlyLeft', 'left'],
  ['modelFlyRight', 'right'],
  ['modelFlyUp', 'up'],
  ['modelFlyDown', 'down'],
];

/**
 * The model stage's movement keys, from the registry: W, A, S, D (or the arrows), Q and E, as Unity's Scene view
 * moves through a level, without holding its right button. Shift moves faster, so it takes no part in which key it is;
 * held with ⌘, Ctrl or Alt they're the window's.
 */
export function flyDirectionOf(event: PressedKey, mac = isMac): FlyDirection | null {
  const unshifted = { ...event, shiftKey: false };
  return FLY_SHORTCUTS.find(([id]) => hotkeys(id).some((key) => matchesShortcut(unshifted, key, mac)))?.[1] ?? null;
}

/** The move of the keys held: opposite keys held together cancel out. */
export function flyMoveOf(held: Iterable<FlyDirection>): FlyMove {
  const directions = new Set(held);
  const axis = (positive: FlyDirection, negative: FlyDirection): number => Number(directions.has(positive)) - Number(directions.has(negative));
  return { forward: axis('forward', 'back'), right: axis('right', 'left'), up: axis('up', 'down') };
}
