import { describe, expect, it } from 'vitest';
import { ACCOUNT_FORMAT } from './accounts';
import { ProfileList } from './ProfileList';
import { formatOutput } from './testing/cmOutput';
import { cmFails, fakeCmClient } from './testing/fakeCmClient';

const PROFILES = formatOutput(['local', 'local', 'ana', 'NameWorkingMode']);

describe('ProfileList', () => {
  it('reads the profiles with one local query that runs in any directory, never their security config', async () => {
    const { cm, commands } = fakeCmClient({ 'profile list': PROFILES });

    expect(await new ProfileList(cm).read()).toBe(PROFILES);
    expect(commands).toMatchObject([{ via: 'query', args: ['profile', 'list', `--format=${ACCOUNT_FORMAT}`], options: { anyDirectory: true } }]);
  });

  it('answers everyone who asks while a read runs with that read, and reads again once it is done', async () => {
    const { cm, commands } = fakeCmClient({ 'profile list': PROFILES });
    const profiles = new ProfileList(cm);

    await Promise.all([profiles.read(), profiles.read(), profiles.readable()]);
    expect(commands).toHaveLength(1);

    await profiles.read();
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
