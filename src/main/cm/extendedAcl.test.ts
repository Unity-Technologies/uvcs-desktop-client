import { describe, expect, it } from 'vitest';
import { ALL_KEYWORD_PERMISSIONS, NO_BITS, PERMISSION_NAMES, type PermissionTarget } from '@shared/domain/permissions';
import { isOwnAcl, parseExtendedAcl } from './extendedAcl';

/** `cm showacl br:/main@codice@codice@cloud --extended`, as cm 11.0.16 prints it (members trimmed). */
const BRANCH_WITH_OWN_ACL = [
  '  ACL: 4136',
  '    Creator br:/main@rep:codice@repserver:codice@cloud',
  '    Entries',
  '     plastichal@unity3d.com:',
  '       Allowed:',
  '        ci',
  '     Developers:',
  '       Denied:',
  '        ci',
  '       Override Allowed:',
  '        ci',
  '    Inherited',
  '      ACL: 0',
  '        Creator rep:codice@repserver:codice@cloud',
  '        Entries',
  '         trunkbuilder@codicesoftware.com:',
  '           Allowed:',
  '            view read',
  '        Inherited',
  '          ACL: 0',
  '            Creator repserver:codice@cloud',
  '            Entries',
  '             Developers:',
  '               Allowed:',
  '                view read rename ci',
  '             OWNER:',
  '               Allowed:',
  '                rmchangeset rmlabel rmattr rm',
  '             unity_china:',
  '               Denied:',
  '                configlocks chgperm advancedquery purge all',
  '',
].join('\n');

/** A branch nobody set permissions on shares its repository's list, which cm shows first. */
const BRANCH_SHARING_ITS_REPOSITORY = [
  '  ACL: 0',
  '    Creator rep:perm-probe@repserver:daniel:8087',
  '    Inherited',
  '      ACL: 0',
  '        Creator repserver:daniel:8087',
  '        Entries',
  '         ALL USERS:',
  '           Allowed:',
  '            all',
  '',
].join('\n');

describe('parseExtendedAcl', () => {
  it('reads each list, its creator and entries, and the lists it inherits from, closest first', () => {
    const acl = parseExtendedAcl(BRANCH_WITH_OWN_ACL);

    expect(acl.creator).toBe('br:/main@rep:codice@repserver:codice@cloud');
    expect(acl.entries).toEqual([
      { member: 'plastichal@unity3d.com', bits: { ...NO_BITS, allowed: ['ci'] } },
      { member: 'Developers', bits: { ...NO_BITS, denied: ['ci'], overrideAllowed: ['ci'] } },
    ]);
    const repository = acl.inherited[0]!;
    expect(repository.creator).toBe('rep:codice@repserver:codice@cloud');
    expect(repository.entries).toEqual([{ member: 'trunkbuilder@codicesoftware.com', bits: { ...NO_BITS, allowed: ['view', 'read'] } }]);
    const server = repository.inherited[0]!;
    expect(server.creator).toBe('repserver:codice@cloud');
    expect(server.entries.map((entry) => entry.member)).toEqual(['Developers', 'OWNER', 'unity_china']);
    expect(server.entries[0]!.bits.allowed).toEqual(['view', 'read', 'rename', 'ci']);
    expect(server.inherited).toEqual([]);
  });

  it('reads "all" as every permission it stands for, and leaves out the ones the app has no name for (purge)', () => {
    const server = parseExtendedAcl(BRANCH_WITH_OWN_ACL).inherited[0]!.inherited[0]!;

    // configlocks, chgperm and advancedquery, and "all" for the rest: every permission once, in cm's order.
    expect(server.entries[2]!.bits.denied).toEqual([...PERMISSION_NAMES]);
    expect(ALL_KEYWORD_PERMISSIONS).not.toContain('advancedquery');
  });

  it('reads a list with no entries of its own, and the special members ALL USERS and OWNER', () => {
    const acl = parseExtendedAcl(BRANCH_SHARING_ITS_REPOSITORY);

    expect(acl).toEqual({
      creator: 'rep:perm-probe@repserver:daniel:8087',
      entries: [],
      inherited: [{ creator: 'repserver:daniel:8087', entries: [{ member: 'ALL USERS', bits: { ...NO_BITS, allowed: [...ALL_KEYWORD_PERMISSIONS] } }], inherited: [] }],
    });
  });

  it('reads Windows line breaks, and names with spaces, accents, other scripts and a colon inside', () => {
    const output = ['  ACL: 7', '    Creator lb:v1@rep:juego@repserver:local', '    Entries', '     Web Devs:', '       Allowed:', '        read', '     José Müller:', '       Denied:', '        rm', '     开发者 a:b:', '       Override Denied:', '        ci', ''].join('\r\n');

    expect(parseExtendedAcl(output).entries).toEqual([
      { member: 'Web Devs', bits: { ...NO_BITS, allowed: ['read'] } },
      { member: 'José Müller', bits: { ...NO_BITS, denied: ['rm'] } },
      { member: '开发者 a:b', bits: { ...NO_BITS, overrideDenied: ['ci'] } },
    ]);
  });

  it('tells a member named like a category from the category, by its indentation', () => {
    const output = ['  ACL: 3', '    Creator att:status@rep:game@repserver:local', '    Entries', '     Allowed:', '       Denied:', '        read', ''].join('\n');

    expect(parseExtendedAcl(output).entries).toEqual([{ member: 'Allowed', bits: { ...NO_BITS, denied: ['read'] } }]);
  });

  it('reads an object that inherits from two lists', () => {
    const output = [
      '  ACL: 9',
      '    Creator br:/main/x@rep:game@repserver:local',
      '    Inherited',
      '      ACL: 1',
      '        Creator rep:game@repserver:local',
      '      ACL: 2',
      '        Creator br:/main@rep:game@repserver:local',
      '        Inherited',
      '          ACL: 0',
      '            Creator repserver:local',
      '',
    ].join('\n');

    const acl = parseExtendedAcl(output);

    expect(acl.inherited.map((level) => level.creator)).toEqual(['rep:game@repserver:local', 'br:/main@rep:game@repserver:local']);
    expect(acl.inherited[1]!.inherited.map((level) => level.creator)).toEqual(['repserver:local']);
  });

  it('reads a long list whole', () => {
    const members = Array.from({ length: 5000 }, (_, index) => [`     user${index}@corp.com:`, '       Allowed:', '        view read ci'].join('\n'));
    const output = ['  ACL: 1', '    Creator repserver:local', '    Entries', ...members, ''].join('\n');

    const acl = parseExtendedAcl(output);

    expect(acl.entries).toHaveLength(5000);
    expect(acl.entries[4999]).toEqual({ member: 'user4999@corp.com', bits: { ...NO_BITS, allowed: ['view', 'read', 'ci'] } });
  });

  it('fails on output that holds no list, rather than reading as no permissions', () => {
    expect(() => parseExtendedAcl('')).toThrow('no access control list');
    expect(() => parseExtendedAcl('Incorrect object specification br:/nope\n')).toThrow('no access control list');
  });
});

describe('isOwnAcl', () => {
  const branch: PermissionTarget = { kind: 'branch', server: 'local', repository: 'game@local', name: '/main/task' };

  it("is the object's own when its creator names it, whatever server the spec names", () => {
    expect(isOwnAcl('br:/main/task@rep:game@repserver:codice@cloud', branch)).toBe(true);
    expect(isOwnAcl('repserver:daniel:8087', { kind: 'server', server: 'local', name: 'local' })).toBe(true);
    expect(isOwnAcl('rep:game@repserver:daniel:8087', { kind: 'repository', server: 'local', repository: 'game@local', name: 'game' })).toBe(true);
    expect(isOwnAcl('lb:v1.0@rep:game@repserver:local', { kind: 'label', server: 'local', repository: 'game@local', name: 'v1.0' })).toBe(true);
    expect(isOwnAcl('att:status@rep:game@repserver:local', { kind: 'attribute', server: 'local', repository: 'game@local', name: 'status' })).toBe(true);
  });

  it("isn't when the first list is the parent's an object shares", () => {
    expect(isOwnAcl('rep:game@repserver:local', branch)).toBe(false);
    expect(isOwnAcl('br:/main@rep:game@repserver:local', branch)).toBe(false);
    expect(isOwnAcl('rep:game2@repserver:local', { kind: 'repository', server: 'local', repository: 'game@local', name: 'game' })).toBe(false);
  });

  it('tells a path on every branch from its groups of branches by the tag', () => {
    const path: PermissionTarget = { kind: 'path', server: 'local', repository: 'game@local', name: '/src/a@b' };

    expect(isOwnAcl('path:/src/a@b@rep:game@repserver:local', path)).toBe(true);
    expect(isOwnAcl('path:/src/a@b#release@rep:game@repserver:local', path)).toBe(false);
    expect(isOwnAcl('path:/src/a@b#release@rep:game@repserver:local', { ...path, tag: 'release' })).toBe(true);
  });
});
