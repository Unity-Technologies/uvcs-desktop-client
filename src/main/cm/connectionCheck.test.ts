import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkConnection, classifyConnectionCheck } from './connectionCheck';
import { cmFails, fakeCmClient, type FakeCmCommand } from './testing/fakeCmClient';

// Outputs of `cm checkconnection <server>` (cm 11.0.16) for a server that doesn't exist and a cloud one without a sign-in.
const NO_SUCH_SERVER = "Error: Can't resolve DNS entry for nowhere.invalid";
const SIGN_IN_PROMPT = 'Getting organization providers...\nSelect the system you want to use to sign in to: acme@cloud\n0 - Okta\n1 - Unity ID';

describe('classifyConnectionCheck', () => {
  it('spots the sign-in prompt of a server without credentials, and credentials the server rejects', () => {
    expect(classifyConnectionCheck(SIGN_IN_PROMPT)).toBe('notSignedIn');
    expect(classifyConnectionCheck('User: ')).toBe('notSignedIn');
    expect(classifyConnectionCheck('Error: The user is not authenticated')).toBe('notSignedIn');
  });

  it('takes anything else as a connection problem', () => {
    expect(classifyConnectionCheck('Error: Connection refused')).toBe('serverUnreachable');
    expect(classifyConnectionCheck(NO_SUCH_SERVER)).toBe('serverUnreachable');
    expect(classifyConnectionCheck('')).toBe('serverUnreachable');
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

describe('checkConnection', () => {
  afterEach(() => vi.useRealTimers());

  it("finds no problem when the server answers, checked in a process that can be killed", async () => {
    const { cm, commands } = fakeCmClient({ 'checkconnection acme@cloud': 'Test connection executed successfully\n' });

    expect(await checkConnection(cm, 'acme@cloud')).toBeNull();
    expect(commands).toMatchObject([{ via: 'execute', args: ['checkconnection', 'acme@cloud'], options: { killSignal: 'SIGKILL' } }]);
  });

  it('reports a server out of reach, with what cm printed', async () => {
    const { cm } = fakeCmClient({ 'checkconnection nowhere.invalid:8087': cmFails(NO_SUCH_SERVER) });

    expect(await checkConnection(cm, 'nowhere.invalid:8087')).toEqual({
      kind: 'serverUnreachable',
      server: 'nowhere.invalid:8087',
      commandLine: 'cm checkconnection nowhere.invalid:8087',
      output: NO_SUCH_SERVER,
    });
  });

  it('stops cm as soon as it asks for a sign-in', async () => {
    const { cm } = fakeCmClient({
      'checkconnection acme@cloud': promptsAndWaits('Getting organization providers...', 'Select the system you want to use to sign in to: acme@cloud      '),
    });

    expect(await checkConnection(cm, 'acme@cloud')).toEqual({
      kind: 'notSignedIn',
      server: 'acme@cloud',
      commandLine: 'cm checkconnection acme@cloud',
      output: 'Getting organization providers...\nSelect the system you want to use to sign in to: acme@cloud',
    });
  });

  it('gives up on a server that never answers after ten seconds', async () => {
    vi.useFakeTimers();
    const { cm } = fakeCmClient({ 'checkconnection acme@cloud': promptsAndWaits() });

    const checking = checkConnection(cm, 'acme@cloud');
    await vi.advanceTimersByTimeAsync(10_000);

    expect(await checking).toEqual({
      kind: 'serverUnreachable',
      server: 'acme@cloud',
      commandLine: 'cm checkconnection acme@cloud',
      output: 'No answer after 10 seconds.',
    });
  });
});
