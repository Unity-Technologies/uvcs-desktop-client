import { describe, expect, it } from 'vitest';
import { ACCOUNT_FORMAT } from '../cm/accounts';
import { formatOutput } from '../cm/testing/cmOutput';
import { fakeCmClient } from '../cm/testing/fakeCmClient';
import { createAccountsService } from './accountsService';
import { serviceContext } from './testing/serviceContext';

describe('accounts', () => {
  it('lists the profiles with one local read, never their security config', async () => {
    const fake = fakeCmClient({ 'profile list': formatOutput(['codice@cloud_ana', 'codice@cloud', 'ana', 'SSOWorkingMode']) });
    const service = createAccountsService(serviceContext(fake.cm));

    expect(await service.list()).toEqual([{ name: 'codice@cloud_ana', server: 'codice@cloud', user: 'ana', workingMode: 'SSOWorkingMode' }]);
    expect(fake.commands).toMatchObject([{ via: 'query', args: ['profile', 'list', `--format=${ACCOUNT_FORMAT}`] }]);
  });

  it('removes a profile by name', async () => {
    const fake = fakeCmClient({ 'profile delete': '' });
    const service = createAccountsService(serviceContext(fake.cm));

    await service.remove('codice@cloud_ana');

    expect(fake.lines()).toEqual(['profile delete --name=codice@cloud_ana']);
  });
});
