import { describe, expect, it } from 'vitest';
import { APPLICABLE_PERMISSIONS, PERMISSION_NAMES } from '@shared/domain/permissions';
import { groupPermissions, PERMISSION_INFO } from './permissionCatalog';
import { describeTarget, pathTarget, repositoryObjectTarget, repositoryTarget, serverTarget, sourceLabel } from './permissionTargets';

describe('targets', () => {
  it('names each object with its repository and server', () => {
    expect(repositoryObjectTarget('branch', '/main/task', 'game@acme@cloud', 'ana')).toEqual({
      kind: 'branch',
      server: 'acme@cloud',
      repository: 'game@acme@cloud',
      name: '/main/task',
      knownOwner: 'ana',
    });
    expect(repositoryTarget('game@acme@cloud')).toEqual({ kind: 'repository', server: 'acme@cloud', repository: 'game@acme@cloud', name: 'game' });
    expect(serverTarget('local')).toEqual({ kind: 'server', server: 'local', name: 'local' });
  });

  it('takes a path from the root with forward slashes, whatever was typed', () => {
    expect(pathTarget('game@local', 'src/a.ts').name).toBe('/src/a.ts');
    expect(pathTarget('game@local', '').name).toBe('/');
    expect(pathTarget('game@local', ' /Art\\Hero/ ').name).toBe('/Art/Hero');
    expect(pathTarget('game@local', '/src', ' release ')).toMatchObject({ name: '/src', tag: 'release' });
    expect(pathTarget('game@local', '/src', '  ')).not.toHaveProperty('tag');
  });

  it('describes what the dialog shows', () => {
    expect(describeTarget(repositoryObjectTarget('branch', '/main/task', 'game@local'))).toBe('Branch /main/task · game@local');
    expect(describeTarget(repositoryTarget('game@local'))).toBe('Repository game · local');
    expect(describeTarget(serverTarget('acme@cloud'))).toBe('Server acme@cloud');
    expect(describeTarget(pathTarget('game@local', '/src'))).toBe('Path /src · all branches · game@local');
    expect(describeTarget(pathTarget('game@local', '/src', 'release'))).toBe('Path /src · branches of release · game@local');
  });

  it('names where an allow or deny comes from', () => {
    expect(sourceLabel('here')).toBe('here');
    expect(sourceLabel('repserver:codice@cloud')).toBe('the server');
    expect(sourceLabel('rep:game@repserver:codice@cloud')).toBe('repository game');
    expect(sourceLabel('br:/main/task@rep:game@repserver:local')).toBe('branch /main/task');
    expect(sourceLabel('path:/src#release@rep:game@repserver:local')).toBe('path /src#release');
  });
});

describe('the permission catalog', () => {
  it('words every permission, and groups each object’s in the groups’ order', () => {
    expect(Object.keys(PERMISSION_INFO).sort()).toEqual([...PERMISSION_NAMES].sort());
    const branch = groupPermissions(APPLICABLE_PERMISSIONS.branch);
    expect(branch.map((group) => group.id)).toEqual(['content', 'branches', 'labels', 'attributes', 'object', 'security', 'replication']);
    expect(branch.flatMap((group) => group.permissions).sort()).toEqual([...APPLICABLE_PERMISSIONS.branch].sort());
    expect(branch[0]!.permissions).toEqual(['view', 'read', 'ci', 'add', 'change', 'move', 'rm']);
  });
});
