import { describe, expect, it } from 'vitest';
import { ACCOUNT_FORMAT } from './accounts';
import { ProfileList } from './ProfileList';
import { checkSetup } from './setupCheck';
import { cmFails, fakeCmClient, type CmAnswer } from './testing/fakeCmClient';

// What every command but `version`, `location`, `configure` and `help` prints (cm 11.0.16) with a fresh home folder.
const NOT_CONFIGURED =
  "Error: Unity VCS client is not correctly configured for the current user: Client config file /Users/me/.plastic4/client.conf not found. Please execute 'cm configure' to perform a text mode configuration or 'macplastic --configure' for graphical mode.";

function profilesAnswering(answer: CmAnswer) {
  const fake = fakeCmClient({ 'profile list': answer });
  return { ...fake, profiles: new ProfileList(fake.cm) };
}

describe('checkSetup', () => {
  it('finds no problem when cm has a configuration, asking only the local profiles read', async () => {
    const { profiles, commands } = profilesAnswering('local\n');

    expect(await checkSetup(profiles)).toBeNull();
    expect(commands).toMatchObject([{ args: ['profile', 'list', `--format=${ACCOUNT_FORMAT}`] }]);
  });

  it('asks nothing once the accounts or the servers read the profiles: cm reads none unconfigured', async () => {
    const { profiles, commands } = profilesAnswering('local\n');
    await profiles.read();

    expect(await checkSetup(profiles)).toBeNull();
    expect(commands).toHaveLength(1);
  });

  it('shares the profiles read the accounts started', async () => {
    const { profiles, commands } = profilesAnswering('local\n');

    const [, problem] = await Promise.all([profiles.read(), checkSetup(profiles)]);

    expect(problem).toBeNull();
    expect(commands).toHaveLength(1);
  });

  it('reports a client that was never configured, with what cm printed', async () => {
    const { profiles } = profilesAnswering(cmFails(NOT_CONFIGURED));

    expect(await checkSetup(profiles)).toEqual({ commandLine: 'cm profile list', output: NOT_CONFIGURED });
  });

  it('takes any other failure as no setup problem: the views tell what fails', async () => {
    const { profiles } = profilesAnswering(cmFails('Error: The profiles file is corrupt'));

    expect(await checkSetup(profiles)).toBeNull();
  });

  it("fails when cm couldn't even be started", async () => {
    const { profiles } = profilesAnswering(() => {
      throw Object.assign(new Error('spawn cm ENOENT'), { code: 'ENOENT' });
    });

    await expect(checkSetup(profiles)).rejects.toThrow('spawn cm ENOENT');
  });
});
