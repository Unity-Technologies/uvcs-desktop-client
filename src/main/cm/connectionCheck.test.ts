import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkConnection, classifyConnectionCheck } from './connectionCheck';
import { cmFails, fakeCmClient, type FakeCmCommand } from './testing/fakeCmClient';

// Outputs of `cm checkconnection <server>` (cm 11.0.16) for a server that doesn't exist and a cloud one without a sign-in.
const NO_SUCH_SERVER = "Error: Can't resolve DNS entry for nowhere.invalid";
const SIGN_IN_PROMPT = 'Getting organization providers...\nSelect the system you want to use to sign in to: acme@cloud\n0 - Okta\n1 - Unity ID';

describe('classifyConnectionCheck', () => {
  it('spots the sign-in prompt of a server without credentials, and a check stopped at it', () => {
    expect(classifyConnectionCheck(SIGN_IN_PROMPT)).toBe('signInRequired');
    expect(classifyConnectionCheck('User: ')).toBe('signInRequired');
    expect(classifyConnectionCheck('cm is waiting for input ("Select your system [0-1]"). Check your credentials for this server.')).toBe('signInRequired');
  });

  it("tells what kind of sign-in problem cm's own sentences name", () => {
    expect(classifyConnectionCheck('Error: The auth token expired. User: dev@acme.com.')).toBe('sessionEnded');
    expect(classifyConnectionCheck('Error: The maximum number of licensed users has been exceeded.')).toBe('noLicense');
  });

  it("takes a secure connection or a proxy that fails for a connection problem, whatever words of authentication it holds", () => {
    // .NET's words when the TLS handshake fails: no sign-in is at stake, and a false one would cover every window.
    expect(classifyConnectionCheck('Error: Authentication failed because the remote party has closed the transport stream.')).toBeNull();
    expect(classifyConnectionCheck('Error: The remote certificate is invalid according to the validation procedure.')).toBeNull();
    expect(classifyConnectionCheck('Error: Proxy Authentication Required (407). Check the credentials of the proxy.')).toBeNull();
  });

  it("reads a prompt only as cm prints it, a line of its own: never words of one inside another sentence", () => {
    expect(classifyConnectionCheck('Error: The proxy asked to sign in to: proxy.acme.com, which failed')).toBeNull();
    expect(classifyConnectionCheck('Error: Wrong User: field in the request')).toBeNull();
  });

  it('takes anything else as a connection problem', () => {
    expect(classifyConnectionCheck('Error: Connection refused')).toBeNull();
    expect(classifyConnectionCheck(NO_SUCH_SERVER)).toBeNull();
    expect(classifyConnectionCheck('')).toBeNull();
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

    expect(await checkConnection(cm, 'acme@cloud')).toEqual({ kind: 'reached' });
    expect(commands).toMatchObject([{ via: 'execute', args: ['checkconnection', 'acme@cloud'], options: { killSignal: 'SIGKILL', server: 'acme@cloud' } }]);
  });

  it('reports a server out of reach, with what cm printed', async () => {
    const { cm } = fakeCmClient({ 'checkconnection nowhere.invalid:8087': cmFails(NO_SUCH_SERVER) });

    expect(await checkConnection(cm, 'nowhere.invalid:8087')).toEqual({
      kind: 'unreachable',
      problem: { server: 'nowhere.invalid:8087', commandLine: 'cm checkconnection nowhere.invalid:8087', output: NO_SUCH_SERVER },
    });
  });

  it('stops cm as soon as it asks for a sign-in', async () => {
    const { cm } = fakeCmClient({
      'checkconnection acme@cloud': promptsAndWaits('Getting organization providers...', 'Select the system you want to use to sign in to: acme@cloud      '),
    });

    expect(await checkConnection(cm, 'acme@cloud')).toEqual({
      kind: 'needsSignIn',
      problem: {
        kind: 'signInRequired',
        server: 'acme@cloud',
        details: { commandLine: 'cm checkconnection acme@cloud', output: 'Getting organization providers...\nSelect the system you want to use to sign in to: acme@cloud' },
      },
    });
  });

  it('tells a session that ended from what cm printed', async () => {
    const expired = 'Error: The auth token expired. User: dev@acme.com.';
    const { cm } = fakeCmClient({ 'checkconnection acme@cloud': cmFails(expired) });

    expect(await checkConnection(cm, 'acme@cloud')).toMatchObject({ kind: 'needsSignIn', problem: { kind: 'sessionEnded', server: 'acme@cloud', details: { output: expired } } });
  });

  it('gives up on a server that never answers after ten seconds', async () => {
    vi.useFakeTimers();
    const { cm } = fakeCmClient({ 'checkconnection acme@cloud': promptsAndWaits() });

    const checking = checkConnection(cm, 'acme@cloud');
    await vi.advanceTimersByTimeAsync(10_000);

    expect(await checking).toEqual({
      kind: 'unreachable',
      problem: { server: 'acme@cloud', commandLine: 'cm checkconnection acme@cloud', output: 'No answer after 10 seconds.' },
    });
  });
});
