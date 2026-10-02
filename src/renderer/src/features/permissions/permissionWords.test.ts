import { describe, expect, it } from 'vitest';
import type { PermissionResolution } from './aclResolution';
import { aboveSentence, effectiveLabel, effectiveSentence, losesToDenyAbove, ownListNotice } from './permissionWords';

const resolution = (parts: Partial<PermissionResolution>): PermissionResolution => ({
  own: 'inherit',
  ignoresAllowsAbove: false,
  ignoresDeniesAbove: false,
  above: {},
  effective: 'notAllowed',
  ...parts,
});

describe('permission words', () => {
  it('says the result and where it comes from', () => {
    expect(effectiveSentence(resolution({ effective: 'allowed', source: 'here' }))).toBe('Allowed here');
    expect(effectiveSentence(resolution({ effective: 'denied', source: 'rep:game@repserver:local' }))).toBe('Denied by repository game');
    expect(effectiveSentence(resolution({}))).toMatch(/^Neither allowed nor denied/);
    expect(effectiveLabel(resolution({ effective: 'denied' }))).toBe('Denied');
  });

  it('says what the lists above say', () => {
    expect(aboveSentence(resolution({ above: { allowedBy: 'repserver:local', deniedBy: 'rep:game@repserver:local' } }))).toBe(
      'Above: allowed by the server · denied by repository game',
    );
    expect(aboveSentence(resolution({}))).toBe('Above: neither allowed nor denied');
  });

  it('says when an object has no list of its own, and what setting a permission does then', () => {
    const shared = { acl: { creator: 'rep:game@repserver:local', entries: [], inherited: [] }, ownAcl: false };
    const branch = { kind: 'branch', server: 'local', repository: 'game@local', name: '/main/task' } as const;
    const path = { kind: 'path', server: 'local', repository: 'game@local', name: '/src' } as const;

    expect(ownListNotice(branch, shared)).toBe('Shares the permissions of repository game: setting one here gives it its own.');
    expect(ownListNotice(path, shared)).toMatch(/^Not secured/);
    expect(ownListNotice({ ...path, tag: 'release' }, shared)).toMatch(/^A new group of branches/);
    expect(ownListNotice(branch, { ...shared, ownAcl: true })).toBeUndefined();
  });

  it('tells an allow here that a deny above beats', () => {
    expect(losesToDenyAbove(resolution({ own: 'allow', effective: 'denied', source: 'rep:game@repserver:local' }))).toBe(true);
    expect(losesToDenyAbove(resolution({ own: 'allow', effective: 'allowed', source: 'here' }))).toBe(false);
    expect(losesToDenyAbove(resolution({ own: 'deny', effective: 'denied', source: 'here' }))).toBe(false);
  });
});
