import { describe, expect, it } from 'vitest';
import { listMembersArgs, ownerNamed, parseMemberNames, parseShowOwner } from './aclMembers';

describe('parseShowOwner', () => {
  it('reads the owner and its kind after the spec, as cm prints them', () => {
    expect(parseShowOwner('br:/main/task1@perm-probe@local daniel.penalba@unity3d.com User\n', 'br:/main/task1@perm-probe@local')).toEqual({
      name: 'daniel.penalba@unity3d.com',
      kind: 'user',
    });
    expect(parseShowOwner('lb:BL1@game@local   Web Devs Group\r\n', 'lb:BL1@game@local')).toEqual({ name: 'Web Devs', kind: 'group' });
  });

  it('reads a spec with spaces, and the server owned by everyone', () => {
    expect(parseShowOwner('path:/My Docs@game@local José Müller User\n', 'path:/My Docs@game@local')).toEqual({ name: 'José Müller', kind: 'user' });
    expect(parseShowOwner('repserver:local           all User\n', 'repserver:local')).toEqual({ name: 'ALL USERS', kind: 'group' });
  });

  it("reads null where there's no owner to read", () => {
    expect(parseShowOwner('', 'br:/main@game@local')).toBeNull();
    expect(parseShowOwner('br:/main@game@local\n', 'br:/main@game@local')).toBeNull();
  });
});

describe('ownerNamed', () => {
  it('takes a listed owner as a user, and all as everyone', () => {
    expect(ownerNamed('ana@corp.com')).toEqual({ name: 'ana@corp.com', kind: 'user' });
    expect(ownerNamed('all')).toEqual({ name: 'ALL USERS', kind: 'group' });
  });
});

describe('cm listusers', () => {
  it('lists one kind of member, filtered on the server when asked', () => {
    expect(listMembersArgs('acme@cloud', 'group')).toEqual(['listusers', 'acme@cloud', '--onlygroups']);
    expect(listMembersArgs('local', 'user', 'dan')).toEqual(['listusers', 'local', '--onlyusers', '--filter=dan']);
  });

  it('reads one name a line, spaces and other scripts kept, Windows line breaks and blank lines dropped', () => {
    expect(parseMemberNames('Administrators\r\nWeb Devs\r\n开发者\r\n\r\n')).toEqual(['Administrators', 'Web Devs', '开发者']);
    expect(parseMemberNames('')).toEqual([]);
  });
});
