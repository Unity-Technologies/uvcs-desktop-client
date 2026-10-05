import { describe, expect, it } from 'vitest';
import { NO_BITS, type AclLevel, type PermissionChanges, type PermissionTarget } from '@shared/domain/permissions';
import { aclArgs, aclCommands, memberOption, pathBranchesArgs, removePathArgs, setOwnerArgs } from './aclArgs';

const branch: PermissionTarget = { kind: 'branch', server: 'local', repository: 'game@local', name: '/main/task' };
const developers = { name: 'Developers', kind: 'group' } as const;
const ana = { name: 'ana@corp.com', kind: 'user' } as const;

describe('memberOption', () => {
  it('names users and groups, and the special members as cm takes them', () => {
    expect(memberOption(ana)).toBe('--user=ana@corp.com');
    expect(memberOption(developers)).toBe('--group=Developers');
    expect(memberOption({ name: 'Web Devs', kind: 'group' })).toBe('--group=Web Devs');
    expect(memberOption({ name: 'ALL USERS', kind: 'group' })).toBe('--group=all');
    expect(memberOption({ name: 'OWNER', kind: 'user' })).toBe('--user=OWNER');
  });
});

describe('aclArgs', () => {
  it('writes only what differs from what the entry says now, added then taken away, in cm order', () => {
    const base = { ...NO_BITS, allowed: ['read', 'ci'], denied: ['rm'] } as typeof NO_BITS;
    const desired = { ...NO_BITS, allowed: ['view', 'read'], overrideDenied: ['ci', 'add'] } as typeof NO_BITS;

    expect(aclArgs('br:/main@game@local', developers, base, desired)).toEqual([
      'acl',
      '--group=Developers',
      '-allowed=+view,-ci',
      '-denied=-rm',
      '-overridedenied=+add,+ci',
      'br:/main@game@local',
    ]);
  });

  it('takes everything away to remove an entry, which the server then drops', () => {
    expect(aclArgs('lb:v1@game@local', ana, { ...NO_BITS, denied: ['rmlabel'], overrideAllowed: ['read'] }, NO_BITS)).toEqual([
      'acl',
      '--user=ana@corp.com',
      '-denied=-rmlabel',
      '-overrideallowed=-read',
      'lb:v1@game@local',
    ]);
  });

  it('runs nothing for an entry that already says it', () => {
    expect(aclArgs('rep:game@local', ana, { ...NO_BITS, allowed: ['ci'] }, { ...NO_BITS, allowed: ['ci'] })).toBeNull();
  });
});

const level = (creator: string, entries: AclLevel['entries'], inherited: AclLevel[] = []): AclLevel => ({ creator, entries, inherited });
const repository = level('rep:game@repserver:local', [{ member: 'Developers', bits: { ...NO_BITS, allowed: ['read', 'ci'] } }]);

describe('aclCommands', () => {
  it('changes each entry of an object with its own list from what that list says', () => {
    const own = level('br:/main/task@rep:game@repserver:local', [{ member: 'Developers', bits: { ...NO_BITS, denied: ['ci'] } }], [repository]);
    const changes: PermissionChanges = {
      seen: { acl: own, ownAcl: true },
      entries: [
        { member: developers, desired: { ...NO_BITS, allowed: ['ci'] } },
        { member: ana, desired: { ...NO_BITS, denied: ['rm'] } },
      ],
    };

    expect(aclCommands(branch, changes)).toEqual([
      ['acl', '--group=Developers', '-allowed=+ci', '-denied=-ci', 'br:/main/task@game@local'],
      ['acl', '--user=ana@corp.com', '-denied=+rm', 'br:/main/task@game@local'],
    ]);
  });

  it("changes the first entry of an object sharing its parent's list from the parent's, which cm copies, and the rest from nothing", () => {
    const changes: PermissionChanges = {
      seen: { acl: repository, ownAcl: false },
      entries: [
        { member: developers, desired: { ...NO_BITS, allowed: ['read'] } },
        { member: { name: 'Developers2', kind: 'group' }, desired: { ...NO_BITS, allowed: ['read'] } },
      ],
    };

    expect(aclCommands(branch, changes)).toEqual([
      ['acl', '--group=Developers', '-allowed=+read,-ci', 'br:/main/task@game@local'],
      ['acl', '--group=Developers2', '-allowed=+read', 'br:/main/task@game@local'],
    ]);
  });

  it("gives the object its own list even when the parent's entry already says it all, and removes nothing from one without", () => {
    const changes: PermissionChanges = {
      seen: { acl: repository, ownAcl: false },
      entries: [
        { member: ana, desired: NO_BITS },
        { member: developers, desired: { ...NO_BITS, allowed: ['read', 'ci'] } },
      ],
    };

    expect(aclCommands(branch, changes)).toEqual([['acl', '--group=Developers', '-allowed=+read,+ci', 'br:/main/task@game@local']]);
  });

  it('skips the entries of an object with its own list that already say it', () => {
    const own = level('br:/main/task@rep:game@repserver:local', [{ member: 'Developers', bits: { ...NO_BITS, allowed: ['ci'] } }]);
    const changes: PermissionChanges = { seen: { acl: own, ownAcl: true }, entries: [{ member: developers, desired: { ...NO_BITS, allowed: ['ci'] } }] };

    expect(aclCommands(branch, changes)).toEqual([]);
  });

  it("creates a path's new group of branches with its first entry", () => {
    const path: PermissionTarget = { kind: 'path', server: 'local', repository: 'game@local', name: '/src', tag: 'release' };
    const changes: PermissionChanges = {
      seen: { acl: repository, ownAcl: false },
      entries: [
        { member: developers, desired: { ...NO_BITS, denied: ['ci'] } },
        { member: ana, desired: { ...NO_BITS, allowed: ['ci'] } },
      ],
      branches: ['/main', '/main/release-2'],
    };

    expect(aclCommands(path, changes)).toEqual([
      ['acl', '--group=Developers', '-allowed=-read,-ci', '-denied=+ci', '--branches=/main,/main/release-2', 'path:/src#release@game@local'],
      ['acl', '--user=ana@corp.com', '-allowed=+ci', 'path:/src#release@game@local'],
    ]);
  });
});

describe('the other commands', () => {
  it('sets the owner, removes a path and edits its branches', () => {
    expect(setOwnerArgs(branch, developers)).toEqual(['setowner', '--group=Developers', 'br:/main/task@game@local']);
    const path: PermissionTarget = { kind: 'path', server: 'local', repository: 'game@local', name: '/My Docs', tag: 'rel' };
    expect(removePathArgs(path)).toEqual(['acl', '--delete', 'path:/My Docs#rel@game@local']);
    expect(pathBranchesArgs(path, ['/main/rel-2'], ['/main'])).toEqual(['acl', '--branches=+/main/rel-2,-/main', 'path:/My Docs#rel@game@local']);
  });
});
