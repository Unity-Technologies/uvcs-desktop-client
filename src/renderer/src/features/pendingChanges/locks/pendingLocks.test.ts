import { describe, expect, it } from 'vitest';
import type { Lock } from '@shared/domain/lock';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { lockedByOthersMessage, locksPendingChanges, pendingLocks } from './pendingLocks';

const change = (path: string): PendingChange => ({ path, kinds: ['checkedOut'], itemType: 'binaryFile', size: 0, lastModified: '' });

function lock(guid: string, path: string, owner: string, status: Lock['status'] = 'Locked'): Lock {
  return { itemId: 1, guid, path, owner, workspace: `${owner}-wk`, status, date: '', destinationBranch: '/main', holderBranch: '/main', repository: 'rvx@local' };
}

describe('pendingLocks', () => {
  const changes = [change('art/Hero.fbx'), change('art/Mine.psd'), change('art/Old.fbx')];
  const mine = [lock('m', '/art/Mine.psd', 'me')];
  const all = [lock('m', '/art/Mine.psd', 'me'), lock('a', '/art/Hero.fbx', 'ana'), lock('r', '/art/Old.fbx', 'bob', 'Retained'), lock('x', '/art/Other.fbx', 'ana')];

  it('tells my exclusive checkouts from locks held by others, on pending changes only', () => {
    expect(pendingLocks(changes, mine, all)).toEqual(
      new Map([
        ['art/Mine.psd', { mine: true, owner: 'me', workspace: 'me-wk' }],
        ['art/Hero.fbx', { mine: false, owner: 'ana', workspace: 'ana-wk' }],
      ]),
    );
  });

  it('counts my lock from another workspace as held by someone else', () => {
    expect(pendingLocks([change('art/Mine.psd')], [], all).get('art/Mine.psd')?.mine).toBe(false);
  });
});

describe('locksPendingChanges', () => {
  const all = [lock('a', '/art/Hero.fbx', 'ana'), lock('r', '/art/Old.fbx', 'bob', 'Retained')];

  it('is true when a held lock is on a pending change', () => {
    expect(locksPendingChanges([change('art/Hero.fbx')], all)).toBe(true);
  });

  it('ignores retained locks and locks on files that are not pending', () => {
    expect(locksPendingChanges([change('art/Old.fbx'), change('art/Other.fbx')], all)).toBe(false);
  });
});

describe('lockedByOthersMessage', () => {
  it('names the owner of a single locked file', () => {
    expect(lockedByOthersMessage([{ path: 'art/Hero.fbx', lock: { mine: false, owner: 'ana', workspace: 'w' } }])).toBe(
      "Hero.fbx is locked by ana — you can't check it in until the lock is released",
    );
  });

  it('counts several', () => {
    const locked = { mine: false, owner: 'ana', workspace: 'w' };
    expect(lockedByOthersMessage([{ path: 'a', lock: locked }, { path: 'b', lock: locked }])).toBe(
      "2 changed files are locked by others — you can't check them in until the locks are released",
    );
  });
});
