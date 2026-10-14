import { describe, expect, it } from 'vitest';
import { checkSetup } from './setupCheck';
import { cmFails, fakeCmClient } from './testing/fakeCmClient';

// What every command but `version`, `location`, `configure` and `help` prints (cm 11.0.16) with a fresh home folder.
const NOT_CONFIGURED =
  "Error: Unity VCS client is not correctly configured for the current user: Client config file /Users/me/.plastic4/client.conf not found. Please execute 'cm configure' to perform a text mode configuration or 'macplastic --configure' for graphical mode.";

describe('checkSetup', () => {
  it('finds no problem when cm has a configuration, asking only a local command in a process of its own', async () => {
    const { cm, commands } = fakeCmClient({ 'profile list': 'local\n' });

    expect(await checkSetup(cm)).toBeNull();
    expect(commands).toMatchObject([{ via: 'execute', args: ['profile', 'list'] }]);
  });

  it('reports a client that was never configured, with what cm printed', async () => {
    const { cm } = fakeCmClient({ 'profile list': cmFails(NOT_CONFIGURED) });

    expect(await checkSetup(cm)).toEqual({ commandLine: 'cm profile list', output: NOT_CONFIGURED });
  });

  it('takes any other failure as no setup problem: the views tell what fails', async () => {
    const { cm } = fakeCmClient({ 'profile list': cmFails('Error: The profiles file is corrupt') });

    expect(await checkSetup(cm)).toBeNull();
  });

  it("fails when cm couldn't even be started", async () => {
    const { cm } = fakeCmClient({
      'profile list': () => {
        throw Object.assign(new Error('spawn cm ENOENT'), { code: 'ENOENT' });
      },
    });

    await expect(checkSetup(cm)).rejects.toThrow('spawn cm ENOENT');
  });
});
