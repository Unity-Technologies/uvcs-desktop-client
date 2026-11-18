import { describe, expect, it } from 'vitest';
import { ACCOUNT_FORMAT } from '../cm/accounts';
import { formatOutput } from '../cm/testing/cmOutput';
import { cmFails, fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { SESSION_CHECK_STALE_MS } from '../accounts/SessionChecks';
import { createAccountsService } from './accountsService';
import { createRepositoriesService } from './repositoriesService';
import { profilesContext, serviceContext, signInContext } from './testing/serviceContext';

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

  it('answers the profiles (and so the accounts made of them) and the servers asked together with one command', async () => {
    const fake = fakeCmClient({ 'profile list': formatOutput(['acme@unity', 'acme@unity', 'ana@example.com', 'SSOWorkingMode']) });
    const profiles = profilesContext(fake.cm);
    const accounts = createAccountsService(serviceContext(fake.cm), profiles);
    const repositories = createRepositoriesService(serviceContext(fake.cm), profiles);

    await Promise.all([accounts.list(), repositories.servers()]);

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

describe("servers' sessions", () => {
  /** The accounts service over `answers`, its sessions checked on a clock the test moves. */
  function sessionsOf(answers: Record<string, CmAnswer>) {
    let time = 0;
    const fake = fakeCmClient(answers);
    const service = createAccountsService(serviceContext(fake.cm, { signIns: signInContext(fake.cm, () => time) }), profilesContext(fake.cm));
    return { ...fake, service, advance: (ms: number) => void (time += ms) };
  }

  it('checks a server as a window opens or comes forward: the first time, then only once stale', async () => {
    const { service, lines, advance } = sessionsOf({ 'checkconnection acme@cloud': 'Test connection executed successfully\n' });

    expect(await service.checkSession('acme@cloud', 'whenStale')).toBeNull();
    advance(SESSION_CHECK_STALE_MS - 1);
    await service.checkSession('acme@cloud', 'whenStale');
    expect(lines()).toEqual(['checkconnection acme@cloud']);

    advance(1);
    await service.checkSession('acme@cloud', 'whenStale');
    expect(lines()).toEqual(['checkconnection acme@cloud', 'checkconnection acme@cloud']);
  });

  it('checks at once when asked to now, as Check again does', async () => {
    const { service, lines } = sessionsOf({ 'checkconnection acme@cloud': 'Test connection executed successfully\n' });

    await service.checkSession('acme@cloud', 'whenStale');
    await service.checkSession('acme@cloud', 'now');

    expect(lines()).toHaveLength(2);
  });

  it('lists a server whose session ended, and answers a server out of reach without marking it', async () => {
    const { service } = sessionsOf({
      'checkconnection acme@cloud': cmFails('Error: The auth token expired. User: dev@acme.com.'),
      'checkconnection build:8087': cmFails("Error: Can't resolve DNS entry for build"),
    });

    expect(await service.checkSession('acme@cloud', 'whenStale')).toBeNull();
    expect(await service.checkSession('build:8087', 'whenStale')).toMatchObject({ server: 'build:8087', output: "Error: Can't resolve DNS entry for build" });

    expect(await service.sessions()).toEqual([
      {
        server: 'acme@cloud',
        state: 'needsSignIn',
        problem: { kind: 'sessionEnded', server: 'acme@cloud', details: { commandLine: 'cm checkconnection acme@cloud', output: 'Error: The auth token expired. User: dev@acme.com.' } },
      },
    ]);
  });
});
