import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MergeToolRequest, SmartMergeTool } from '@shared/domain/mergeTools';
import { cmFails, fakeCmClient, optionValue, type CmAnswer } from '../cm/testing/fakeCmClient';
import { launchMergeTool } from '../merge/mergeTools/launch';
import { memorySettings } from '../settings/testing/memorySettings';
import { AppIcons } from '../system/apps/AppIcons';
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
  trySmartMergeFirst: false,
};

/** `cm cat revid:N@…` writes "version N" to the file it is given. */
const CAT_VERSIONS: CmAnswer = async ({ args }) => {
  await writeFile(optionValue(args, '--file=')!, `version ${/revid:(\d+)/.exec(args[1]!)![1]}`);
  return '';
};

/** `smartMerge`: where Smart Merge is, standing in for this machine's Unity Editors; none by default. */
function mergeTools(answers: Record<string, CmAnswer>, smartMerge: SmartMergeTool | null = null) {
  const fake = fakeCmClient(answers);
  const settings = memorySettings({ mergeTool: MY_TOOL.id, customMergeTools: [MY_TOOL], mergeToolArgs: {} });
  const apps = { installedApps: { get: async () => NO_INSTALLED_APPS } as never, icons: new AppIcons('linux', async () => undefined) };
  return { ...fake, service: createMergeToolsService(serviceContext(fake.cm, { settings }), apps, () => smartMerge) };
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

describe('Smart Merge before the merge tool', () => {
  const SMART_MERGE: SmartMergeTool = { executable: join(tmpdir(), 'Unity', 'UnityYAMLMerge'), editorVersion: '6000.3.19f1' };
  const UNITY_HEADER = '%YAML 1.1\n%TAG !u! tag:unity3d.com,2011:\n';
  const PREFAB_REQUEST: MergeToolRequest = { ...REQUEST, path: 'Assets/Player.prefab', trySmartMergeFirst: true };

  /** `cm cat revid:N@…` writes a Unity asset, "version N" in it. */
  const CAT_PREFABS: CmAnswer = async ({ args }) => {
    await writeFile(optionValue(args, '--file=')!, `${UNITY_HEADER}version ${/revid:(\d+)/.exec(args[1]!)![1]}\n`);
    return '';
  };

  /** Smart Merge ends with `exitCode` after writing `written` to the result; the tool saves "merged by hand". */
  function smartMergeEnds(exitCode: number | null, written: string) {
    vi.mocked(launchMergeTool).mockImplementation(async (executable, args) => {
      if (executable === SMART_MERGE.executable) {
        await writeFile(args.at(-1)!, written);
        return { exitCode, errorOutput: '', seconds: 0.2 };
      }
      await writeFile(args[4]!, 'merged by hand\n');
      return { exitCode: 0, errorOutput: '', seconds: 30 };
    });
  }

  const launched = () => vi.mocked(launchMergeTool).mock.calls.map(([executable]) => executable);

  beforeEach(() => {
    vi.mocked(launchMergeTool).mockReset();
  });

  it('takes Smart Merge’s merge of a Unity asset and opens no tool', async () => {
    let smartMergeArgs: string[] = [];
    vi.mocked(launchMergeTool).mockImplementation(async (_executable, args) => {
      smartMergeArgs = args;
      await writeFile(args.at(-1)!, `${UNITY_HEADER}merged\n`);
      return { exitCode: 0, errorOutput: '', seconds: 0.2 };
    });
    const { service } = mergeTools({ cat: CAT_PREFABS }, SMART_MERGE);

    expect(await service.resolve(WORKSPACE, PREFAB_REQUEST)).toEqual({ kind: 'resolved', text: `${UNITY_HEADER}merged\n`, tool: 'Smart Merge' });
    expect(launched()).toEqual([SMART_MERGE.executable]);
    const [base, incoming, yours, result] = smartMergeArgs.slice(-4);
    expect(smartMergeArgs.slice(0, 5)).toEqual(['merge', '-h', '--force', '--fallback', 'none']);
    expect([base, incoming, yours, result].map((file) => file!.split(/[\\/]/).pop())).toEqual(['Player.BASE.prefab', 'Player.INCOMING.prefab', 'Player.YOURS.prefab', 'Player.prefab']);
  });

  it('opens the tool on the file as it stood when Smart Merge leaves conflicts, never on its half merge', async () => {
    let resultWhenToolOpened = '';
    vi.mocked(launchMergeTool).mockImplementation(async (executable, args) => {
      if (executable === SMART_MERGE.executable) {
        await writeFile(args.at(-1)!, `${UNITY_HEADER}base values where they disagree\n`);
        return { exitCode: 2, errorOutput: '', seconds: 0.2 };
      }
      resultWhenToolOpened = await readFile(args[4]!, 'utf8');
      await writeFile(args[4]!, 'merged by hand\n');
      return { exitCode: 0, errorOutput: '', seconds: 30 };
    });
    const { service } = mergeTools({ cat: CAT_PREFABS }, SMART_MERGE);

    expect(await service.resolve(WORKSPACE, PREFAB_REQUEST)).toEqual({ kind: 'resolved', text: 'merged by hand\n' });
    expect(launched()).toEqual([SMART_MERGE.executable, MY_TOOL.executable]);
    expect(resultWhenToolOpened).toBe(PREFAB_REQUEST.startText);
  });

  it('opens the tool when Smart Merge can’t start', async () => {
    vi.mocked(launchMergeTool).mockImplementation(async (executable, args) => {
      if (executable === SMART_MERGE.executable) throw new Error(`Couldn't start ${executable}: it is not there anymore`);
      await writeFile(args[4]!, 'merged by hand\n');
      return { exitCode: 0, errorOutput: '', seconds: 30 };
    });
    const { service } = mergeTools({ cat: CAT_PREFABS }, SMART_MERGE);

    expect(await service.resolve(WORKSPACE, PREFAB_REQUEST)).toEqual({ kind: 'resolved', text: 'merged by hand\n' });
  });

  it('leaves files that aren’t Unity assets to the tool, whatever their name', async () => {
    smartMergeEnds(0, 'never');
    const { service } = mergeTools({ cat: CAT_VERSIONS }, SMART_MERGE);

    expect(await service.resolve(WORKSPACE, PREFAB_REQUEST)).toEqual({ kind: 'resolved', text: 'merged by hand\n' });
    expect(launched()).toEqual([MY_TOOL.executable]);
  });

  it('opens the tool straight away once something was decided for the file, or without a Unity Editor', async () => {
    smartMergeEnds(0, 'never');
    const decided = mergeTools({ cat: CAT_PREFABS }, SMART_MERGE).service;
    await decided.resolve(WORKSPACE, { ...PREFAB_REQUEST, trySmartMergeFirst: false });
    const noUnity = mergeTools({ cat: CAT_PREFABS }).service;
    await noUnity.resolve(WORKSPACE, PREFAB_REQUEST);

    expect(launched()).toEqual([MY_TOOL.executable, MY_TOOL.executable]);
  });

  it('opens nothing more when the user stops waiting while Smart Merge runs', async () => {
    let started: () => void = () => undefined;
    const smartMergeStarted = new Promise<void>((resolve) => (started = resolve));
    vi.mocked(launchMergeTool).mockImplementation((_executable, _args, signal) => {
      started();
      return new Promise((resolve) => signal.addEventListener('abort', () => resolve({ exitCode: null, errorOutput: '', seconds: 1 })));
    });
    const { service } = mergeTools({ cat: CAT_PREFABS }, SMART_MERGE);

    const resolving = service.resolve(WORKSPACE, PREFAB_REQUEST);
    await smartMergeStarted;
    await service.stopWaiting(PREFAB_REQUEST.sessionId);

    expect(await resolving).toEqual({ kind: 'unchanged', exitCode: null, errorOutput: '' });
    expect(launched()).toEqual([SMART_MERGE.executable]);
  });

  it('lists Smart Merge apart from the tools to pick', async () => {
    const { service } = mergeTools({}, SMART_MERGE);

    const { tools, smartMerge } = await service.list();
    expect(smartMerge).toEqual(SMART_MERGE);
    expect(tools.map((tool) => tool.executable)).not.toContain(SMART_MERGE.executable);
  });
});
