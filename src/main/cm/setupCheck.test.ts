import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkSetup, classifySetupCheck, signInServer } from './setupCheck';
import { cmFails, fakeCmClient, type FakeCmCommand } from './testing/fakeCmClient';

// Outputs of `cm checkconnection` (cm 11.0.16) with a fresh home folder, an unreachable server and a cloud server without a sign-in.
const NOT_CONFIGURED =
  "Error: Unity VCS client is not correctly configured for the current user: Client config file /Users/me/.plastic4/client.conf not found. Please execute 'cm configure' to perform a text mode configuration or 'macplastic --configure' for graphical mode.";
const SIGN_IN_PROMPT = 'Getting organization providers...\nSelect the system you want to use to sign in to: codice@cloud\n0 - Okta Unity\n1 - Unity ID';

describe('classifySetupCheck', () => {
  it('spots a client that was never configured', () => {
    expect(classifySetupCheck(NOT_CONFIGURED)).toBe('notConfigured');
  });

  it('spots the sign-in prompt of a server without credentials', () => {
    expect(classifySetupCheck(SIGN_IN_PROMPT)).toBe('notSignedIn');
    expect(classifySetupCheck('User: ')).toBe('notSignedIn');
  });

  it('takes anything else as a connection problem', () => {
    expect(classifySetupCheck('Error: Connection refused')).toBe('serverUnreachable');
    expect(classifySetupCheck("Error: Can't resolve DNS entry for nonexistent.example")).toBe('serverUnreachable');
    expect(classifySetupCheck('')).toBe('serverUnreachable');
  });
});

describe('signInServer', () => {
  it('reads the server named by the sign-in prompt', () => {
    expect(signInServer(SIGN_IN_PROMPT)).toBe('codice@cloud');
    expect(signInServer('Error: Connection refused')).toBeUndefined();
  });
});

/** A `cm checkconnection` that prints `lines` and then waits, as at a prompt, until it is killed. */
function promptsAndWaits(...lines: string[]) {
  return ({ options }: FakeCmCommand): Promise<string> => {
    lines.forEach((line) => options.onOutputLine?.(line));
    return new Promise((_resolve, reject) => {
      const killed = (): void => reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
      if (options.signal?.aborted) killed();
      else options.signal?.addEventListener('abort', killed);
    });
  };
}

describe('checkSetup', () => {
  afterEach(() => vi.useRealTimers());

  it('finds no problem when cm reaches its server, checked in a process that can be killed', async () => {
    const { cm, commands } = fakeCmClient({ checkconnection: 'Test connection executed successfully\n' });

    expect(await checkSetup(cm)).toBeNull();
    expect(commands).toMatchObject([{ via: 'execute', args: ['checkconnection'], options: { killSignal: 'SIGKILL' } }]);
  });

  it('reports a client that was never configured, with what cm printed', async () => {
    const { cm } = fakeCmClient({ checkconnection: cmFails(NOT_CONFIGURED) });

    expect(await checkSetup(cm)).toEqual({ kind: 'notConfigured', server: undefined, commandLine: 'cm checkconnection', output: NOT_CONFIGURED });
  });

  it('stops cm as soon as it asks for a sign-in, and names the server', async () => {
    const { cm } = fakeCmClient({
      checkconnection: promptsAndWaits('Getting organization providers...', 'Select the system you want to use to sign in to: codice@cloud      '),
    });

    expect(await checkSetup(cm)).toEqual({
      kind: 'notSignedIn',
      server: 'codice@cloud',
      commandLine: 'cm checkconnection',
      output: 'Getting organization providers...\nSelect the system you want to use to sign in to: codice@cloud',
    });
  });

  it('gives up on a server that never answers after ten seconds', async () => {
    vi.useFakeTimers();
    const { cm } = fakeCmClient({ checkconnection: promptsAndWaits() });

    const checking = checkSetup(cm);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(await checking).toEqual({ kind: 'serverUnreachable', server: undefined, commandLine: 'cm checkconnection', output: 'No answer after 10 seconds.' });
  });

  it("fails when cm couldn't even be started", async () => {
    const { cm } = fakeCmClient({
      checkconnection: () => {
        throw Object.assign(new Error('spawn cm ENOENT'), { code: 'ENOENT' });
      },
    });

    await expect(checkSetup(cm)).rejects.toThrow('spawn cm ENOENT');
  });
});
