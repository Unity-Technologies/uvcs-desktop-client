import { fakeApi } from '../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const asked = vi.hoisted(() => ({ confirmed: true }));
vi.mock('../../ui/dialog/confirm', () => ({ confirm: async () => asked.confirmed }));

import type { Lock, LockStatus } from '@shared/domain/lock';
import { shownToasts } from '../../testing/operationOutcome';
import { isReleasable, releaseLocks, removeLocks } from './lockOperations';

const ws = '/ws';
const lock = (path: string, status: LockStatus = 'Locked'): Lock => ({
  itemId: 1,
  guid: 'g',
  path,
  owner: 'ana',
  workspace: 'art-wk',
  status,
  date: '',
  destinationBranch: '/main',
  holderBranch: '/main/art',
  repository: 'game@local',
});

beforeEach(() => {
  asked.confirmed = true;
});

describe('lock operations', () => {
  it('releases only locks still held: retained ones are already released', () => {
    expect(isReleasable(lock('/a.psd'))).toBe(true);
    expect(isReleasable(lock('/a.psd', 'Retained'))).toBe(false);
  });

  it('releases the locks, keeping them retained until the change reaches its branch', async () => {
    fakeApi.answer('locks.unlock', () => undefined);

    await releaseLocks(ws, [lock('/art/hero.psd')]);

    expect(fakeApi.argsOf('locks.unlock')).toEqual([[ws, [lock('/art/hero.psd')], { remove: false }]]);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Released the lock on hero.psd' }]);
  });

  it('removes locks entirely only once confirmed', async () => {
    fakeApi.answer('locks.unlock', () => undefined);

    asked.confirmed = false;
    await removeLocks(ws, [lock('/a.psd'), lock('/b.psd')]);
    expect(fakeApi.methods()).toEqual([]);

    asked.confirmed = true;
    await removeLocks(ws, [lock('/a.psd'), lock('/b.psd')]);
    expect(fakeApi.argsOf('locks.unlock')).toEqual([[ws, [lock('/a.psd'), lock('/b.psd')], { remove: true }]]);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Removed 2 locks' }]);
  });

  it('reports a remove the server refused (only administrators may), with no success', async () => {
    fakeApi.answer('locks.unlock', () => {
      throw new Error('You are not an administrator');
    });

    await removeLocks(ws, [lock('/a.psd')]);

    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't remove the lock", detail: 'You are not an administrator' }]);
  });
});
