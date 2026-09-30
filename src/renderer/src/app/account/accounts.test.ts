import { fakeApi } from '../../testing/fakeWindow';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account } from '@shared/domain/account';

vi.mock('../../ui/dialog/confirm', () => import('../../testing/fakeDialogs'));

import { queryKeys } from '../../api/queryKeys';
import { answerConfirms } from '../../testing/fakeDialogs';
import { shownToasts } from '../../testing/operationOutcome';
import { queryClient } from '../queryClient';
import { readServerUser, removeAccount } from './accounts';

const acme: Account = { name: 'acme@cloud', server: 'acme@cloud', user: 'ana@acme.com', workingMode: 'SSOWorkingMode' };

afterEach(() => {
  vi.clearAllMocks();
  queryClient.clear();
});

describe('readServerUser', () => {
  it('is the user of the profile cm signs in with on that server', async () => {
    fakeApi.answer('accounts.list', () => [acme]);
    fakeApi.answer('system.currentUser', () => 'default-user');

    await expect(readServerUser('acme@cloud')).resolves.toBe('ana@acme.com');
    expect(fakeApi.methods()).toEqual(['accounts.list']);
  });

  it("is client.conf's default user where no profile matches", async () => {
    fakeApi.answer('accounts.list', () => [acme]);
    fakeApi.answer('system.currentUser', () => 'default-user');

    await expect(readServerUser('localhost:8087')).resolves.toBe('default-user');
  });

  it('asks main once, answering later questions from what it read', async () => {
    fakeApi.answer('accounts.list', () => []);
    fakeApi.answer('system.currentUser', () => 'default-user');

    await readServerUser('localhost:8087');
    await readServerUser('localhost:8087');

    expect(fakeApi.methods()).toEqual(['accounts.list', 'system.currentUser']);
  });
});

describe('removeAccount', () => {
  beforeEach(() => {
    queryClient.setQueryData(queryKeys.accounts, [acme]);
    queryClient.setQueryData(queryKeys.profiles, []);
  });

  it('removes nothing unless the user confirms', async () => {
    answerConfirms(false);

    await removeAccount(acme);

    expect(fakeApi.methods()).toEqual([]);
  });

  it('removes the profile by its name, then re-reads the accounts and servers', async () => {
    fakeApi.answer('accounts.remove', () => undefined);

    await removeAccount(acme);

    expect(fakeApi.calls()).toContainEqual({ method: 'accounts.remove', args: ['acme@cloud'] });
    expect(queryClient.getQueryState(queryKeys.accounts)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.profiles)?.isInvalidated).toBe(true);
  });

  it('reports a removal that failed, and still re-reads what may have changed', async () => {
    fakeApi.answer('accounts.remove', () => {
      throw new Error('profile is in use');
    });

    await removeAccount(acme);

    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't remove the account", detail: 'profile is in use' }]);
    expect(queryClient.getQueryState(queryKeys.accounts)?.isInvalidated).toBe(true);
  });
});
