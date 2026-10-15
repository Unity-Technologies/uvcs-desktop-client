import { describe, expect, it } from 'vitest';
import { ACCOUNT_FORMAT } from '../cm/accounts';
import { formatOutput } from '../cm/testing/cmOutput';
import { fakeCmClient } from '../cm/testing/fakeCmClient';
import { createAccountsService } from './accountsService';
import { profilesContext, serviceContext } from './testing/serviceContext';

describe('accounts', () => {
  it('lists the profiles with one local read in any directory, never their security config', async () => {
    const fake = fakeCmClient({ 'profile list': formatOutput(['acme@cloud_ana', 'acme@cloud', 'ana', 'SSOWorkingMode']) });
    const service = createAccountsService(serviceContext(fake.cm), profilesContext(fake.cm));

    expect(await service.list()).toEqual([{ name: 'acme@cloud_ana', server: 'acme@cloud', user: 'ana', workingMode: 'SSOWorkingMode' }]);
    expect(fake.commands).toMatchObject([{ via: 'query', args: ['profile', 'list', `--format=${ACCOUNT_FORMAT}`], options: { anyDirectory: true } }]);
  });

  it('lists the profiles again after removing one, never sharing a read that started before the removal', async () => {
    let profiles = formatOutput(['acme@cloud_ana', 'acme@cloud', 'ana', 'SSOWorkingMode']);
    let finishFirstRead = (): void => {};
    const firstRead = new Promise<void>((resolve) => (finishFirstRead = resolve));
    let reads = 0;
    const fake = fakeCmClient({
      'profile list': async () => {
        const listed = profiles;
        if (reads++ === 0) await firstRead;
        return listed;
      },
      'profile delete': () => {
        profiles = '';
        return '';
      },
    });
    const service = createAccountsService(serviceContext(fake.cm), profilesContext(fake.cm));

    const before = service.list();
    await service.remove('acme@cloud_ana');
    const after = service.list();
    finishFirstRead();

    expect(await after).toEqual([]);
    await before;
    expect(fake.lines().map((line) => line.split(' --')[0])).toEqual(['profile list', 'profile delete', 'profile list']);
  });

  it('removes a profile by name, with a local command run in any directory', async () => {
    const fake = fakeCmClient({ 'profile delete': '' });
    const service = createAccountsService(serviceContext(fake.cm), profilesContext(fake.cm));

    await service.remove('acme@cloud_ana');

    expect(fake.commands).toMatchObject([{ via: 'query', args: ['profile', 'delete', '--name=acme@cloud_ana'], options: { anyDirectory: true } }]);
  });
});
