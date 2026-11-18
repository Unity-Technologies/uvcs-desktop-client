import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import type { ServerSession } from '@shared/domain/signIn';
import { CmClient, type CmRunners } from '../cm/CmClient';
import { CmSignInError } from '../cm/CmSignInError';
import type { CmResult } from '../cm/CmResult';
import type { WorkspaceStatus } from '../cm/workspaceStatus';
import { WorkspaceServers } from '../workspace/WorkspaceServers';
import { trackSignIns } from './signIns';

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');
const EXPIRED = 'Error: The auth token expired. User: dev@acme.com.\n';

/**
 * The real `CmClient` and sign-in state over fake runners: every command `cm` would run is recorded, and a server
 * answers as signed in or not as the test says. `WORKSPACE` is on acme@cloud, as its header said.
 */
async function app() {
  const ran: string[] = [];
  const signedIn = new Set<string>(['build:8087']);
  const answer = (args: string[]): CmResult => {
    ran.push(args.filter((arg) => !arg.startsWith('--encoding')).join(' '));
    const server = args[0] === 'checkconnection' ? args[1]! : args.includes('build:8087') ? 'build:8087' : 'acme@cloud';
    if (args[0] === 'status' || signedIn.has(server)) return { output: 'Test connection executed successfully\n', exitCode: 0 };
    return { output: EXPIRED, exitCode: 1 };
  };
  const runners: CmRunners = {
    runProcess: async (_cmPath, args) => answer(args),
    createShellPool: () => ({
      run: async (_cwd, args) => answer(args),
      isReady: () => true,
      shownDirectory: () => undefined,
      show: () => undefined,
      warmUp: () => undefined,
      release: () => undefined,
      disposeAll: () => undefined,
      restartSessions: () => void ran.push('(shells restarted)'),
    }),
  };
  const cm = new CmClient(() => 'cm', join(tmpdir(), 'outside-workspaces'), 'linux', runners);
  const workspaceServers = new WorkspaceServers('linux');
  await workspaceServers.remembering({ status: async () => ({ server: 'acme@cloud' }) as WorkspaceStatus, names: async () => ({ name: 'game', guid: 'g' }) }).status(WORKSPACE);
  const told: ServerSession[][] = [];
  const signIns = trackSignIns(cm, workspaceServers, (sessions) => told.push(sessions));
  const read = (args: string[], options = { cwd: WORKSPACE }) => cm.query(args, options).catch((error: unknown) => error);
  return { cm, ran, signedIn, signIns, told, read };
}

describe('one sign-in state per server', () => {
  it('confirms the first sign-in failure with one check, then runs no command to that server however many reads follow', async () => {
    const { ran, read, told } = await app();

    expect(await read(['fileinfo', 'a.cs', '--xml'])).toBeInstanceOf(CmSignInError);
    expect(ran).toEqual(['fileinfo a.cs --xml', 'checkconnection acme@cloud']);
    expect(told).toEqual([[{ server: 'acme@cloud', state: 'needsSignIn', problem: expect.objectContaining({ kind: 'sessionEnded' }) }]]);

    ran.length = 0;
    const reads = await Promise.all(Array.from({ length: 10 }, (_, i) => read(['fileinfo', `${i}.cs`, '--xml'])));

    expect(reads.every((error) => error instanceof CmSignInError)).toBe(true);
    expect(ran).toEqual([]);
  });

  it("still runs local commands, and another server's", async () => {
    const { ran, read } = await app();
    await read(['fileinfo', 'a.cs', '--xml']);
    ran.length = 0;

    await read(['status', '--header', '--xml']);
    await read(['fileinfo', 'a.cs@game@build:8087', '--xml'], { cwd: join(tmpdir(), 'elsewhere') });

    expect(ran).toEqual(['status --header --xml', 'fileinfo a.cs@game@build:8087 --xml']);
  });

  it('runs the reads again once a check finds the server signed in, and restarts the shells once', async () => {
    const { ran, read, signedIn, signIns, told } = await app();
    await read(['fileinfo', 'a.cs', '--xml']);
    signedIn.add('acme@cloud');
    ran.length = 0;

    await signIns.sessionChecks.whenStale('acme@cloud');
    expect(await read(['fileinfo', 'a.cs', '--xml'])).toBe('Test connection executed successfully\n');

    expect(ran).toEqual(['checkconnection acme@cloud', '(shells restarted)', 'fileinfo a.cs --xml']);
    expect(told.at(-1)).toEqual([]);
  });
});
