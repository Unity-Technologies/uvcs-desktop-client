import { describe, expect, it } from 'vitest';
import { APPLICABLE_PERMISSIONS, PERMISSION_NAMES, permissionSpec, serverOfRepository } from './permissions';

describe('permissionSpec', () => {
  it('names each kind of object as cm acl and cm showacl take it', () => {
    expect(permissionSpec({ kind: 'server', server: 'acme@cloud', name: 'acme@cloud' })).toBe('repserver:acme@cloud');
    expect(permissionSpec({ kind: 'repository', server: 'acme@cloud', repository: 'game@acme@cloud', name: 'game' })).toBe('rep:game@acme@cloud');
    expect(permissionSpec({ kind: 'repository', server: 'local', name: 'game' })).toBe('rep:game@local');
    expect(permissionSpec({ kind: 'branch', server: 'local', repository: 'game@local', name: '/main/task' })).toBe('br:/main/task@game@local');
    expect(permissionSpec({ kind: 'label', server: 'local', repository: 'game@local', name: 'v1.0' })).toBe('lb:v1.0@game@local');
    expect(permissionSpec({ kind: 'attribute', server: 'local', repository: 'game@local', name: 'status' })).toBe('att:status@game@local');
  });

  it('names a path on every branch, and a group of branches by its tag', () => {
    expect(permissionSpec({ kind: 'path', server: 'local', repository: 'game@local', name: '/src' })).toBe('path:/src@game@local');
    expect(permissionSpec({ kind: 'path', server: 'local', repository: 'game@local', name: '/My Docs', tag: 'release' })).toBe('path:/My Docs#release@game@local');
  });
});

describe('serverOfRepository', () => {
  it('is what follows the repository name, which holds no @', () => {
    expect(serverOfRepository('game@local')).toBe('local');
    expect(serverOfRepository('codice@codice@cloud')).toBe('codice@cloud');
    expect(serverOfRepository('game')).toBe('');
  });
});

describe('APPLICABLE_PERMISSIONS', () => {
  it("offers each object only permissions cm knows, in cm's order", () => {
    for (const permissions of Object.values(APPLICABLE_PERMISSIONS)) {
      expect(permissions).toEqual(PERMISSION_NAMES.filter((name) => permissions.includes(name)));
    }
  });

  it('keeps what only a server or repository decides off the objects inside them', () => {
    expect(APPLICABLE_PERMISSIONS.repository).not.toContain('mkrepository');
    expect(APPLICABLE_PERMISSIONS.branch).not.toContain('mklabel');
    expect(APPLICABLE_PERMISSIONS.label).toContain('rmlabel');
    expect(APPLICABLE_PERMISSIONS.path).toEqual(['chgperm', 'chgowner', 'read', 'add', 'change', 'move', 'rm', 'ci']);
  });
});
