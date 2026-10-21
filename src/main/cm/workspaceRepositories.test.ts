import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cmFails, fakeCmClient, type FakeCmCommand } from './testing/fakeCmClient';
import { repositoryInStatusHeader, workspaceRepositoryLookup } from './workspaceRepositories';

describe('repositoryInStatusHeader', () => {
  it('reads the repository spec', () => {
    expect(repositoryInStatusHeader('STATUS|25076|website|acme@cloud\n')).toBe('website@acme@cloud');
    // A Unity organization's server by name, which `cm status --xml` gives by its id.
    expect(repositoryInStatusHeader('STATUS|51|3dtest/game|AcmeStudio@unity\n')).toBe('3dtest/game@AcmeStudio@unity');
  });

  it('accepts workspaces without a loaded changeset', () => {
    expect(repositoryInStatusHeader('STATUS|-1|ImageDiffTest|local')).toBe('ImageDiffTest@local');
  });

  it('returns null for anything else', () => {
    expect(repositoryInStatusHeader('/tmp is not in a workspace.')).toBeNull();
  });
});

describe('workspaceRepositoryLookup', () => {
  const workspaceFolders = (count: number): Promise<string[]> => Promise.all(Array.from({ length: count }, () => mkdtemp(join(tmpdir(), 'wk-'))));
  /** Each workspace is on a repository named after its folder. */
  const statusHeader = ({ args }: FakeCmCommand): string => `STATUS|12|${args.at(-1)!.split(/[\\/]/).at(-1)}|local\n`;
  const notCancelled = () => new AbortController().signal;

  it("reads a workspace's repository with a local cm status of its own process, killed if it hangs", async () => {
    const [first] = await workspaceFolders(1);
    const { cm, commands } = fakeCmClient({ status: statusHeader });

    expect(await workspaceRepositoryLookup(cm)(first!, notCancelled())).toBe(`${first!.split(/[\\/]/).at(-1)}@local`);
    expect(commands).toMatchObject([
      { via: 'execute', args: ['status', '--header', '--machinereadable', '--fieldseparator=|', first], options: { killSignal: 'SIGKILL' } },
    ]);
  });

  it('asks nothing about a folder that is gone, and takes a failed lookup as unknown', async () => {
    const [failing] = await workspaceFolders(1);
    const { cm, commands } = fakeCmClient({ status: cmFails('Error: The server is unreachable.') });
    const lookUp = workspaceRepositoryLookup(cm);

    expect(await lookUp(join(tmpdir(), 'no-such-workspace'), notCancelled())).toBeNull();
    expect(await lookUp(failing!, notCancelled())).toBeNull();
    expect(commands).toHaveLength(1);
  });

  it('looks up two at a time across the calls the home screen makes for each workspace', async () => {
    const folders = await workspaceFolders(5);
    let running = 0;
    let most = 0;
    const { cm } = fakeCmClient({
      status: async (command) => {
        most = Math.max(most, ++running);
        await Promise.resolve();
        running--;
        return statusHeader(command);
      },
    });
    const lookUp = workspaceRepositoryLookup(cm);

    const answers = await Promise.all(folders.map((folder) => lookUp(folder, notCancelled())));

    expect(answers).toEqual(folders.map((folder) => `${folder.split(/[\\/]/).at(-1)}@local`));
    expect(most).toBe(2);
  });

  it('skips a lookup cancelled before its turn', async () => {
    const [folder] = await workspaceFolders(1);
    const { cm, commands } = fakeCmClient({ status: statusHeader });
    const cancelled = new AbortController();
    cancelled.abort();

    expect(await workspaceRepositoryLookup(cm)(folder!, cancelled.signal)).toBeNull();
    expect(commands).toEqual([]);
  });
});
