import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account } from '@shared/domain/account';

const uvcs = await vi.hoisted(async () => (await import('../../lib/testing/fakeWindow')).installFakeWindow());

vi.mock('../../ui/dialog/confirm', () => ({ confirm: vi.fn() }));

import { queryKeys } from '../../api/queryKeys';
import { confirm } from '../../ui/dialog/confirm';
import { useToastStore } from '../../ui/toast/toastStore';
import { queryClient } from '../queryClient';
import { readServerUser, removeAccount } from './accounts';

const acme: Account = { name: 'acme@cloud', server: 'acme@cloud', user: 'ana@acme.com', workingMode: 'SSOWorkingMode' };


beforeEach(() => {
  uvcs.reset();
  useToastStore.setState({ toasts: [] });
});
afterEach(() => {
  vi.clearAllMocks();
  queryClient.clear();
});

describe('readServerUser', () => {
  it('is the user of the profile cm signs in with on that server', async () => {
    uvcs.answerWith({ 'accounts.list': [acme], 'system.currentUser': 'default-user' });

    await expect(readServerUser('acme@cloud')).resolves.toBe('ana@acme.com');
    expect(uvcs.methodsCalled()).toEqual(['accounts.list']);
  });

  it("is client.conf's default user where no profile matches", async () => {
    uvcs.answerWith({ 'accounts.list': [acme], 'system.currentUser': 'default-user' });

    await expect(readServerUser('localhost:8087')).resolves.toBe('default-user');
  });

  it('asks main once, answering later questions from what it read', async () => {
    uvcs.answerWith({ 'accounts.list': [], 'system.currentUser': 'default-user' });

    await readServerUser('localhost:8087');
    await readServerUser('localhost:8087');

    expect(uvcs.methodsCalled()).toEqual(['accounts.list', 'system.currentUser']);
  });
});

describe('removeAccount', () => {
  beforeEach(() => {
    queryClient.setQueryData(queryKeys.accounts, [acme]);
    queryClient.setQueryData(queryKeys.profiles, []);
  });

  it('removes nothing unless the user confirms', async () => {
    vi.mocked(confirm).mockResolvedValue(false);

    await removeAccount(acme);

    expect(uvcs.methodsCalled()).toEqual([]);
  });

  it('removes the profile by its name, then re-reads the accounts and servers', async () => {
    vi.mocked(confirm).mockResolvedValue(true);

    await removeAccount(acme);

    expect(uvcs.calls).toContainEqual({ method: 'accounts.remove', args: ['acme@cloud'] });
    expect(queryClient.getQueryState(queryKeys.accounts)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.profiles)?.isInvalidated).toBe(true);
  });

  it('reports a removal that failed, and still re-reads what may have changed', async () => {
    vi.mocked(confirm).mockResolvedValue(true);
    uvcs.answerWith({ 'accounts.remove': new Error('profile is in use') });

    await removeAccount(acme);

    expect(useToastStore.getState().toasts).toEqual([expect.objectContaining({ kind: 'error', title: "Couldn't remove the account", detail: 'profile is in use' })]);
    expect(queryClient.getQueryState(queryKeys.accounts)?.isInvalidated).toBe(true);
  });
});
