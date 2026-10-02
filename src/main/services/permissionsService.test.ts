import { describe, expect, it } from 'vitest';
import { NO_BITS, type PermissionTarget } from '@shared/domain/permissions';
import { parseExtendedAcl } from '../cm/extendedAcl';
import { extendedAclOutput } from '../cm/testing/cmOutput';
import { cmFails, fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { createPermissionsService } from './permissionsService';
import { serviceContext } from './testing/serviceContext';

function permissions(answers: Record<string, CmAnswer>) {
  const fake = fakeCmClient(answers);
  return { ...fake, service: createPermissionsService(serviceContext(fake.cm)) };
}

const SERVER_ACL = { creator: 'repserver:local', entries: { 'ALL USERS': { Allowed: 'all' } } };
const REPOSITORY_ACL = { creator: 'rep:game@repserver:local', entries: { Developers: { Allowed: 'read ci' } }, inherited: [SERVER_ACL] };
const branch: PermissionTarget = { kind: 'branch', server: 'local', repository: 'game@local', name: '/main/task' };
const path: PermissionTarget = { kind: 'path', server: 'local', repository: 'game@local', name: '/src' };

describe('reading permissions', () => {
  it('reads the list and the owner with one quick command each, in a cm shell', async () => {
    const { service, commands } = permissions({
      'showacl br:/main/task@game@local --extended': extendedAclOutput({ creator: 'br:/main/task@rep:game@repserver:local', entries: { 'ana@corp.com': { Denied: 'ci' } }, inherited: [REPOSITORY_ACL] }),
      'showowner br:/main/task@game@local': 'br:/main/task@game@local ana@corp.com User\n',
    });

    const read = await service.read(branch);

    expect(read.ownAcl).toBe(true);
    expect(read.owner).toEqual({ name: 'ana@corp.com', kind: 'user' });
    expect(read.acl.entries).toEqual([{ member: 'ana@corp.com', bits: { ...NO_BITS, denied: ['ci'] } }]);
    expect(read.acl.inherited[0]!.creator).toBe('rep:game@repserver:local');
    expect(commands.map((command) => command.via)).toEqual(['query', 'query']);
  });

  it("tells an object sharing its parent's list, and takes the owner its list already read instead of asking", async () => {
    const { service, lines } = permissions({ 'showacl br:/main/task@game@local --extended': extendedAclOutput(REPOSITORY_ACL) });

    const read = await service.read({ ...branch, knownOwner: 'bob@corp.com' });

    expect(read.ownAcl).toBe(false);
    expect(read.owner).toEqual({ name: 'bob@corp.com', kind: 'user' });
    expect(lines()).toEqual(['showacl br:/main/task@game@local --extended']);
  });

  it("reads a path nobody secured as its repository's list, without an owner", async () => {
    const { service, lines } = permissions({
      'showacl path:/src@game@local': cmFails('Incorrect object specification path:/src@game@local'),
      'showowner path:/src@game@local': cmFails('Incorrect object specification path:/src@game@local'),
      'showacl rep:game@local --extended': extendedAclOutput(REPOSITORY_ACL),
    });

    const read = await service.read(path);

    expect(read).toMatchObject({ ownAcl: false, owner: null });
    expect(read.acl.creator).toBe('rep:game@repserver:local');
    expect(lines()).toEqual(['showacl path:/src@game@local --extended', 'showowner path:/src@game@local', 'showacl rep:game@local --extended']);
  });

  it("fails as cm reports it when a path can't be read for another reason", async () => {
    const { service } = permissions({
      'showacl path:/src@game@local': cmFails('Error: The server local is unreachable.'),
      'showowner path:/src@game@local': cmFails('Error: The server local is unreachable.'),
    });

    await expect(service.read(path)).rejects.toThrow('unreachable');
  });

  it("reads a secured path's group of branches by its tag", async () => {
    const { service } = permissions({
      'showacl path:/src#release@game@local --extended': extendedAclOutput({ creator: 'path:/src#release@rep:game@repserver:local', inherited: [REPOSITORY_ACL] }),
      'showowner path:/src#release@game@local': 'path:/src#release@game@local ana User\n',
    });

    expect((await service.read({ ...path, tag: 'release' })).ownAcl).toBe(true);
  });
});

describe('members', () => {
  it("lists the server's groups or users, filtered on the server when asked", async () => {
    const { service, commands } = permissions({ 'listusers acme@cloud': 'Administrators\nWeb Devs\n' });

    expect(await service.members('acme@cloud', 'group')).toEqual(['Administrators', 'Web Devs']);
    await service.members('acme@cloud', 'user', 'dan');
    expect(commands.map(({ via, line }) => `${via} ${line}`)).toEqual(['query listusers acme@cloud --onlygroups', 'query listusers acme@cloud --onlyusers --filter=dan']);
  });
});

describe('applying changes', () => {
  it('sets each changed entry with a command of its own, then the owner', async () => {
    const { service, commands } = permissions({ acl: 'Command finished successfully\n', setowner: '' });
    const acl = parseExtendedAcl(extendedAclOutput({ creator: 'br:/main/task@rep:game@repserver:local', entries: { Developers: { Denied: 'ci' } }, inherited: [REPOSITORY_ACL] }));

    await service.apply(branch, {
      seen: { acl, ownAcl: true },
      entries: [
        { member: { name: 'Developers', kind: 'group' }, desired: NO_BITS },
        { member: { name: 'ALL USERS', kind: 'group' }, desired: { ...NO_BITS, denied: ['rm'] } },
      ],
      owner: { name: 'Leads', kind: 'group' },
    });

    expect(commands.map(({ via, line }) => `${via} ${line}`)).toEqual([
      'query acl --group=Developers -denied=-ci br:/main/task@game@local',
      'query acl --group=all -denied=+rm br:/main/task@game@local',
      'query setowner --group=Leads br:/main/task@game@local',
    ]);
  });

  it('stops at the first command that fails, as cm reports it', async () => {
    const { service, lines } = permissions({ acl: cmFails('Error: You do not have permission to change permissions.') });
    const acl = parseExtendedAcl(extendedAclOutput(REPOSITORY_ACL));

    await expect(
      service.apply(branch, {
        seen: { acl, ownAcl: false },
        entries: [
          { member: { name: 'Developers', kind: 'group' }, desired: { ...NO_BITS, allowed: ['read'] } },
          { member: { name: 'ana', kind: 'user' }, desired: { ...NO_BITS, allowed: ['read'] } },
        ],
        owner: { name: 'ana', kind: 'user' },
      }),
    ).rejects.toThrow('permission to change permissions');
    expect(lines()).toEqual(['acl --group=Developers -allowed=+read,-ci br:/main/task@game@local']);
  });

  it("removes a path's own permissions and edits its group's branches", async () => {
    const { service, lines } = permissions({ acl: 'Command finished successfully\n' });

    await service.removePath(path);
    await service.editPathBranches({ ...path, tag: 'release' }, { add: ['/main/rel-2'], remove: ['/main'] });

    expect(lines()).toEqual(['acl --delete path:/src@game@local', 'acl --branches=+/main/rel-2,-/main path:/src#release@game@local']);
  });
});
