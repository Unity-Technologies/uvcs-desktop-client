import { describe, expect, it } from 'vitest';
import { ACCOUNT_FORMAT } from './accounts';
import { ProfileList } from './ProfileList';
import { formatOutput } from './testing/cmOutput';
import { cmFails, fakeCmClient } from './testing/fakeCmClient';

const PROFILES = formatOutput(['local', 'local', 'ana', 'NameWorkingMode']);

describe('ProfileList', () => {
  it('reads the profiles with one local query that runs in any directory, never their security config', async () => {
    const { cm, commands } = fakeCmClient({ 'profile list': PROFILES });

    expect(await new ProfileList(cm).read()).toEqual([{ name: 'local', server: 'local', user: 'ana', workingMode: 'NameWorkingMode' }]);
    expect(commands).toMatchObject([{ via: 'query', readsRecords: true, args: ['profile', 'list', `--format=${ACCOUNT_FORMAT}`], options: { anyDirectory: true } }]);
  });

  it('answers everyone who asks while a read runs with that read, and reads again once it is done', async () => {
    const { cm, commands } = fakeCmClient({ 'profile list': PROFILES });
    const profiles = new ProfileList(cm);

    await Promise.all([profiles.read(), profiles.read(), profiles.readable()]);
    expect(commands).toHaveLength(1);

    await profiles.read();
    expect(commands).toHaveLength(2);
  });

  it('answers no one with a read it was told to forget, and keeps sharing the newer read after the forgotten one ends', async () => {
    const finish: (() => void)[] = [];
    const { cm, commands } = fakeCmClient({
      'profile list': async () => {
        const read = commands.length;
        await new Promise<void>((resolve) => finish.push(resolve));
        return formatOutput([`read ${read}`]);
      },
    });
    const profiles = new ProfileList(cm);

    const old = profiles.read();
    profiles.forget();
    const fresh = profiles.read();
    finish[0]!();
    const named = async (read: Promise<{ name: string }[]>) => (await read).map(({ name }) => name);
    expect(await named(old)).toEqual(['read 1']);

    const sharing = profiles.read();
    finish[1]!();
    expect(await named(fresh)).toEqual(['read 2']);
    expect(await named(sharing)).toEqual(['read 2']);
    expect(commands).toHaveLength(2);
  });

  it('reads again after a read failed, and not once one succeeded', async () => {
    let configured = false;
    const { cm, commands } = fakeCmClient({ 'profile list': () => (configured ? PROFILES : cmFails('Error: client.conf not found')) });
    const profiles = new ProfileList(cm);

    await expect(profiles.readable()).rejects.toThrow('client.conf not found');
    configured = true;
    await profiles.readable();
    await profiles.readable();

    expect(commands).toHaveLength(2);
  });
});
