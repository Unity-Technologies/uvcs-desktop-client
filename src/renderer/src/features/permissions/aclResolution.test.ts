import { describe, expect, it } from 'vitest';
import { NO_BITS, type AclBits, type AclLevel } from '@shared/domain/permissions';
import { levelsAbove, readOwnBits, resolvePermissions } from './aclResolution';

const bits = (parts: Partial<AclBits>): AclBits => ({ ...NO_BITS, ...parts });
const level = (creator: string, entries: Record<string, Partial<AclBits>>, inherited: AclLevel[] = []): AclLevel => ({
  creator,
  entries: Object.entries(entries).map(([member, parts]) => ({ member, bits: bits(parts) })),
  inherited,
});

const SERVER = 'repserver:local';
const REPOSITORY = 'rep:game@repserver:local';
const BRANCH = 'br:/main/task@rep:game@repserver:local';
const server = level(SERVER, { Developers: { allowed: ['read', 'ci', 'rm'] }, 'ALL USERS': { allowed: ['view'] } });
const repository = level(REPOSITORY, { Developers: { denied: ['rm'] } }, [server]);

describe('resolvePermissions', () => {
  it('follows the lists above where the own entry says nothing, naming the closest that decides', () => {
    const resolved = resolvePermissions({ acl: repository, ownAcl: false }, 'Developers', NO_BITS, ['read', 'rm', 'mergefrom']);

    expect(resolved.get('read')).toMatchObject({ own: 'inherit', effective: 'allowed', source: SERVER, above: { allowedBy: SERVER } });
    // A deny wins over an allow, wherever each is set.
    expect(resolved.get('rm')).toMatchObject({ effective: 'denied', source: REPOSITORY, above: { allowedBy: SERVER, deniedBy: REPOSITORY } });
    expect(resolved.get('mergefrom')).toMatchObject({ effective: 'notAllowed', source: undefined, above: {} });
  });

  it('decides here what the own entry allows or denies, but an allow still loses to a deny above', () => {
    const own = level(BRANCH, { Developers: { allowed: ['rm', 'mergefrom'], denied: ['read'] } }, [repository]);
    const permissions = { acl: own, ownAcl: true };

    const resolved = resolvePermissions(permissions, 'Developers', readOwnBits(permissions, 'Developers'), ['read', 'rm', 'mergefrom']);

    expect(resolved.get('read')).toMatchObject({ own: 'deny', effective: 'denied', source: 'here' });
    expect(resolved.get('mergefrom')).toMatchObject({ own: 'allow', effective: 'allowed', source: 'here' });
    expect(resolved.get('rm')).toMatchObject({ own: 'allow', effective: 'denied', source: REPOSITORY });
  });

  it('drops what the lists above allow or deny where the own entry overrides it', () => {
    const own = bits({ allowed: ['rm'], overrideDenied: ['rm'], overrideAllowed: ['read'] });

    const resolved = resolvePermissions({ acl: level(BRANCH, {}, [repository]), ownAcl: true }, 'Developers', own, ['read', 'rm']);

    expect(resolved.get('rm')).toMatchObject({ own: 'allow', ignoresDeniesAbove: true, effective: 'allowed', source: 'here', above: { deniedBy: REPOSITORY } });
    expect(resolved.get('read')).toMatchObject({ own: 'inherit', ignoresAllowsAbove: true, effective: 'notAllowed', above: { allowedBy: SERVER } });
  });

  it("applies a list's overrides to the lists above it, not to itself", () => {
    const overriding = level(REPOSITORY, { Developers: { allowed: ['ci'], overrideAllowed: ['ci', 'read'] } }, [server]);

    const resolved = resolvePermissions({ acl: overriding, ownAcl: false }, 'Developers', NO_BITS, ['ci', 'read']);

    expect(resolved.get('ci')).toMatchObject({ effective: 'allowed', source: REPOSITORY });
    expect(resolved.get('read')).toMatchObject({ effective: 'notAllowed' });
  });

  it('counts only the member asked about', () => {
    const resolved = resolvePermissions({ acl: repository, ownAcl: false }, 'ALL USERS', NO_BITS, ['view', 'read']);

    expect(resolved.get('view')).toMatchObject({ effective: 'allowed', source: SERVER });
    expect(resolved.get('read')).toMatchObject({ effective: 'notAllowed' });
  });

  it('allows what every list inherited side by side allows, and denies what any denies', () => {
    const first = level('rep:a@repserver:local', { ana: { allowed: ['read', 'ci'] } });
    const second = level('br:/main@rep:a@repserver:local', { ana: { allowed: ['read'], denied: ['rm'] } });

    const resolved = resolvePermissions({ acl: level(BRANCH, {}, [first, second]), ownAcl: true }, 'ana', NO_BITS, ['read', 'ci', 'rm']);

    expect([...resolved.values()].map((resolution) => resolution.effective)).toEqual(['allowed', 'notAllowed', 'denied']);
  });
});

describe('levelsAbove and readOwnBits', () => {
  it('reads the own entry from an own list, and nothing from a shared one', () => {
    const own = level(BRANCH, { ana: { denied: ['ci'] } }, [repository]);

    expect(levelsAbove({ acl: own, ownAcl: true })).toEqual([repository]);
    expect(readOwnBits({ acl: own, ownAcl: true }, 'ana')).toEqual(bits({ denied: ['ci'] }));
    expect(levelsAbove({ acl: repository, ownAcl: false })).toEqual([repository]);
    expect(readOwnBits({ acl: repository, ownAcl: false }, 'Developers')).toEqual(NO_BITS);
  });
});
