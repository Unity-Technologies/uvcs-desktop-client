import { describe, expect, it } from 'vitest';
import { ACCOUNT_FORMAT } from '../cm/accounts';
import { formatOutput } from '../cm/testing/cmOutput';
import { fakeCmClient } from '../cm/testing/fakeCmClient';
import { createAccountsService } from './accountsService';
import { serviceContext } from './testing/serviceContext';

describe('accounts', () => {
  it('lists the profiles with one local read, never their security config', async () => {
    const fake = fakeCmClient({ 'profile list': formatOutput(['acme@cloud_ana', 'acme@cloud', 'ana', 'SSOWorkingMode']) });
    const service = createAccountsService(serviceContext(fake.cm));

    expect(await service.list()).toEqual([{ name: 'acme@cloud_ana', server: 'acme@cloud', user: 'ana', workingMode: 'SSOWorkingMode' }]);
    expect(fake.commands).toMatchObject([{ via: 'query', args: ['profile', 'list', `--format=${ACCOUNT_FORMAT}`] }]);
  });

  it('removes a profile by name', async () => {
    const fake = fakeCmClient({ 'profile delete': '' });
    const service = createAccountsService(serviceContext(fake.cm));

    await service.remove('acme@cloud_ana');

    expect(fake.lines()).toEqual(['profile delete --name=acme@cloud_ana']);
  });
});
