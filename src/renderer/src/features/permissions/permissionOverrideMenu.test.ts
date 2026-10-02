import { describe, expect, it, vi } from 'vitest';
import type { PermissionResolution } from './aclResolution';
import { overrideMenuEntries } from './permissionOverrideMenu';

const resolution = (parts: Partial<PermissionResolution>): PermissionResolution => ({
  own: 'inherit',
  ignoresAllowsAbove: false,
  ignoresDeniesAbove: false,
  above: {},
  effective: 'notAllowed',
  ...parts,
});

describe('the overrides menu of a permission', () => {
  it('turns each override on, or off once on, saying which', () => {
    const onOverride = vi.fn();
    const entries = overrideMenuEntries(resolution({ ignoresDeniesAbove: true }), onOverride);

    expect(entries.map((entry) => entry.label)).toEqual(['Ignore allows from above', 'Stop ignoring denies from above']);

    entries[0]!.run();
    entries[1]!.run();
    expect(onOverride.mock.calls).toEqual([
      ['overrideAllowed', true],
      ['overrideDenied', false],
    ]);
  });
});
