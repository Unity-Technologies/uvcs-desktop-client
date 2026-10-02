import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MergeToolRequest } from '@shared/domain/mergeTools';
import { cmFails, fakeCmClient, optionValue, type CmAnswer } from '../cm/testing/fakeCmClient';
import { launchMergeTool } from '../merge/mergeTools/launch';
import { memorySettings } from '../settings/testing/memorySettings';
import { NO_INSTALLED_APPS } from '../system/apps/installedApps';
import { createMergeToolsService } from './mergeToolsService';
import { serviceContext } from './testing/serviceContext';

vi.mock('electron', () => ({ dialog: {} }));
// The one place a merge tool starts: here it only reports how it was started.
vi.mock('../merge/mergeTools/launch', () => ({ launchMergeTool: vi.fn(), activateApp: vi.fn() }));

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');
const MY_TOOL = { id: 'custom:0', name: 'My merge', executable: join(tmpdir(), 'bin', 'mymerge'), args: ['{base}', '{yours}', '{incoming}', '-o', '{result}', '-t', '{yoursName}'] };

const REQUEST: MergeToolRequest = {
  sessionId: 'session-1',
  toolId: MY_TOOL.id,
  path: 'src/player.cs',
  base: { kind: 'revision', revision: { revisionId: 10, repository: 'game@local' }, fileName: 'player.cs' },
  yours: { kind: 'revision', revision: { revisionId: 11, repository: 'game@local' }, fileName: 'player.cs' },
  incoming: { kind: 'revision', revision: { revisionId: 12, repository: 'game@local' }, fileName: 'player.cs' },
  startText: '<<<<<<< conflict\n',
  names: { base: 'Base', yours: 'Yours (/main/task1)', incoming: 'Incoming (/main)' },
};

/** `cm cat revid:N@…` writes "version N" to the file it is given. */
const CAT_VERSIONS: CmAnswer = async ({ args }) => {
  await writeFile(optionValue(args, '--file=')!, `version ${/revid:(\d+)/.exec(args[1]!)![1]}`);
  return '';
};

function mergeTools(answers: Record<string, CmAnswer>) {
  const fake = fakeCmClient(answers);
  const settings = memorySettings({ mergeTool: MY_TOOL.id, customMergeTools: [MY_TOOL], mergeToolArgs: {} });
  return { ...fake, service: createMergeToolsService(serviceContext(fake.cm, { settings }), { installedApps: { get: async () => NO_INSTALLED_APPS } as never }) };
}

/** The tool as launched: its arguments and what each file held when it opened. */
async function launchedFiles() {
  const [[executable, args, signal]] = vi.mocked(launchMergeTool).mock.calls;
  const [base, yours, incoming, , result] = args;
  return { executable, args, signal, contents: await Promise.all([base, yours, incoming, result].map((file) => readFile(file!, 'utf8'))) };
}

describe('resolving a file in a merge tool', () => {
  beforeEach(() => {
    vi.mocked(launchMergeTool).mockReset();
  });

  it('saves the three versions, opens the tool on them and brings back what the user saved', async () => {
    let seen: Awaited<ReturnType<typeof launchedFiles>> | undefined;
    vi.mocked(launchMergeTool).mockImplementation(async (_executable, args) => {
      seen = await launchedFiles();
      await writeFile(args[4]!, 'merged by hand\n');
      return { exitCode: 0, errorOutput: '', seconds: 30 };
    });
    const { service, commands } = mergeTools({ cat: CAT_VERSIONS });

    const outcome = await service.resolve(WORKSPACE, REQUEST);

    expect(outcome).toEqual({ kind: 'resolved', text: 'merged by hand\n' });
    expect(commands.map(({ via, args }) => [via, args[1]])).toEqual([
      ['query', 'revid:10@game@local'],
      ['query', 'revid:11@game@local'],
      ['query', 'revid:12@game@local'],
    ]);
    expect(seen?.executable).toBe(MY_TOOL.executable);
    expect(seen?.contents).toEqual(['version 10', 'version 11', 'version 12', '<<<<<<< conflict\n']);
    expect(seen?.args.slice(-2)).toEqual(['-t', 'Yours (/main/task1)']);
    expect(existsSync(dirname(seen!.args[0]!))).toBe(false);
  });

  it('brings back nothing when the tool closes without saving', async () => {
    vi.mocked(launchMergeTool).mockResolvedValue({ exitCode: 0, errorOutput: '', seconds: 30 });
    const { service } = mergeTools({ cat: CAT_VERSIONS });

    expect(await service.resolve(WORKSPACE, REQUEST)).toEqual({ kind: 'unchanged', exitCode: 0, errorOutput: '' });
  });

  it('opens nothing for a tool that is no longer installed', async () => {
    const { service, commands } = mergeTools({});

    expect(await service.resolve(WORKSPACE, { ...REQUEST, toolId: 'custom:9' })).toEqual({ kind: 'failed', message: "That merge tool isn't installed anymore." });
    expect(commands).toEqual([]);
    expect(launchMergeTool).not.toHaveBeenCalled();
  });

  it("opens nothing when a version can't be read", async () => {
    const { service } = mergeTools({ cat: cmFails('Error: The revision 12 does not exist.') });

    expect(await service.resolve(WORKSPACE, REQUEST)).toEqual({ kind: 'failed', message: 'The revision 12 does not exist.' });
    expect(launchMergeTool).not.toHaveBeenCalled();
  });

  it('stops waiting for the tool when the user asks', async () => {
    let opened: () => void = () => undefined;
    const toolOpened = new Promise<void>((resolve) => (opened = resolve));
    vi.mocked(launchMergeTool).mockImplementation((_executable, _args, signal) => {
      opened();
      return new Promise((resolve) => signal.addEventListener('abort', () => resolve({ exitCode: null, errorOutput: '', seconds: 5 })));
    });
    const { service } = mergeTools({ cat: CAT_VERSIONS });

    const resolving = service.resolve(WORKSPACE, REQUEST);
    await toolOpened;
    await service.stopWaiting(REQUEST.sessionId);

    expect(await resolving).toEqual({ kind: 'unchanged', exitCode: null, errorOutput: '' });
  });
});
