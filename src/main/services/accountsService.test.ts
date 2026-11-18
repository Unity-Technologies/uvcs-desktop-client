import { describe, expect, it } from 'vitest';
import { ACCOUNT_FORMAT } from '../cm/accounts';
import { formatOutput } from '../cm/testing/cmOutput';
import { fakeCmClient } from '../cm/testing/fakeCmClient';
import { createAccountsService } from './accountsService';
import { createRepositoriesService } from './repositoriesService';
import { profilesContext, serviceContext } from './testing/serviceContext';

describe('accounts', () => {
  it('lists the profiles with one local read in any directory, never their security config', async () => {
    const fake = fakeCmClient({ 'profile list': formatOutput(['acme@cloud_ana', 'acme@cloud', 'ana', 'SSOWorkingMode']) });
    const service = createAccountsService(serviceContext(fake.cm), profilesContext(fake.cm));

    expect(await service.list()).toEqual([{ name: 'acme@cloud_ana', server: 'acme@cloud', user: 'ana', workingMode: 'SSOWorkingMode' }]);
    expect(fake.commands).toMatchObject([{ via: 'query', args: ['profile', 'list', `--format=${ACCOUNT_FORMAT}`], options: { anyDirectory: true } }]);
  });

  it('keeps a wildcard profile (`*@cloud`), which signs in to every cloud organization', async () => {
    const fake = fakeCmClient({ 'profile list': [formatOutput(['*@cloud_ana', '*@cloud', 'ana', 'SSOWorkingMode']), formatOutput(['build_ana', 'build.example.com:8087', 'ana', 'LDAPWorkingMode'])].join('') });
    const service = createAccountsService(serviceContext(fake.cm), profilesContext(fake.cm));

    expect((await service.list()).map((account) => account.server)).toEqual(['*@cloud', 'build.example.com:8087']);
  });

  it('groups the profiles into accounts, from the same one local read', async () => {
    const fake = fakeCmClient({
      'profile list': [
        formatOutput(['*@cloud', '*@cloud', 'ana@example.com', 'SSOWorkingMode']),
        formatOutput(['acme@unity', 'acme@unity', 'ana@example.com', 'SSOWorkingMode']),
        formatOutput(['build:8087', 'build:8087', 'jsmith', 'UPWorkingMode']),
        formatOutput(['local', 'local', 'ana@example.com', 'SSOWorkingMode']),
      ].join(''),
    });
    const service = createAccountsService(serviceContext(fake.cm), profilesContext(fake.cm));

    expect((await service.accounts()).map(({ id, servers }) => [id, servers])).toEqual([
      ['cloud:ana@example.com', ['acme@unity']],
      ['server:build:8087', ['build:8087']],
    ]);
    expect(fake.commands).toMatchObject([{ via: 'query', args: ['profile', 'list', `--format=${ACCOUNT_FORMAT}`], options: { anyDirectory: true } }]);
  });

  it('answers the accounts, the profiles and the servers asked together with one command', async () => {
    const fake = fakeCmClient({ 'profile list': formatOutput(['acme@unity', 'acme@unity', 'ana@example.com', 'SSOWorkingMode']) });
    const profiles = profilesContext(fake.cm);
    const accounts = createAccountsService(serviceContext(fake.cm), profiles);
    const repositories = createRepositoriesService(serviceContext(fake.cm), profiles);

    await Promise.all([accounts.accounts(), accounts.list(), repositories.servers()]);

    expect(fake.commands).toHaveLength(1);
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
