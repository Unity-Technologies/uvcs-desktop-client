import type { Action } from '../../lib/actions';
import type { PermissionResolution } from './aclResolution';
import type { OverrideKind } from './permissionsDraft';

/**
 * The menu of a permission's row: its two overrides, each turning on or off. The labels say what picking them does
 * ("Stop ignoring…" once on), since menu entries show no checkmark. Every combination the server stores stays reachable.
 */
export function overrideMenuEntries(resolution: PermissionResolution, onOverride: (kind: OverrideKind, on: boolean) => void): Action[] {
  return [
    {
      id: 'permission-override-allowed',
      label: resolution.ignoresAllowsAbove ? 'Stop ignoring allows from above' : 'Ignore allows from above',
      run: () => onOverride('overrideAllowed', !resolution.ignoresAllowsAbove),
    },
    {
      id: 'permission-override-denied',
      label: resolution.ignoresDeniesAbove ? 'Stop ignoring denies from above' : 'Ignore denies from above',
      run: () => onOverride('overrideDenied', !resolution.ignoresDeniesAbove),
    },
  ];
}
