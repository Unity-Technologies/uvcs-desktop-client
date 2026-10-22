import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MergeToolRequest, SmartMergeRequest, UnityYamlMergeTool } from '@shared/domain/mergeTools';
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
};

/** `cm cat revid:N@…` writes "version N" to the file it is given. */
const CAT_VERSIONS: CmAnswer = async ({ args }) => {
  await writeFile(optionValue(args, '--file=')!, `version ${/revid:(\d+)/.exec(args[1]!)![1]}`);
  return '';
};

/** `unityYamlMerges`: every editor's UnityYAMLMerge, newest first, standing in for this machine's; none by default. */
function mergeTools(answers: Record<string, CmAnswer>, ...unityYamlMerges: UnityYamlMergeTool[]) {
  const fake = fakeCmClient(answers);
  const settings = memorySettings({ mergeTool: MY_TOOL.id, customMergeTools: [MY_TOOL], mergeToolArgs: {} });
  const apps = { installedApps: { get: async () => NO_INSTALLED_APPS } as never, icons: new AppIcons('linux', { thumbnail: async () => undefined, fileIcon: async () => undefined }) };
  return { ...fake, service: createMergeToolsService(serviceContext(fake.cm, { settings }), apps, () => unityYamlMerges) };
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

describe('Smart Merge', () => {
  const SMART_MERGE: UnityYamlMergeTool = { id: 'unityyamlmerge:6000.3.19f1', executable: join(tmpdir(), 'Unity', 'UnityYAMLMerge'), editorVersion: '6000.3.19f1' };
  const OLDER: UnityYamlMergeTool = { id: 'unityyamlmerge:2022.3.10f1', executable: join(tmpdir(), 'Unity2022', 'UnityYAMLMerge'), editorVersion: '2022.3.10f1' };
  const UNITY_HEADER = '%YAML 1.1\n%TAG !u! tag:unity3d.com,2011:\n';
  const PREFAB: SmartMergeRequest = {
    sessionId: 'session-2',
    toolId: 'unityyamlmerge',
    path: 'Assets/Player.prefab',
    base: `${UNITY_HEADER}base\n`,
    yours: `${UNITY_HEADER}yours\n`,
    incoming: `${UNITY_HEADER}incoming\n`,
  };

  /** Smart Merge ends with `exitCode` after writing `written` to the result; what it was given, as files. */
  function smartMergeEnds(exitCode: number | null, written: string, errorOutput = '') {
    const seen: { args: string[]; hidden: boolean | undefined; files: string[] }[] = [];
    vi.mocked(launchMergeTool).mockImplementation(async (_executable, args, _signal, options) => {
      seen.push({ args, hidden: options?.hidden, files: await Promise.all(args.slice(-4, -1).map((file) => readFile(file, 'utf8'))) });
      await writeFile(args.at(-1)!, written);
      return { exitCode, errorOutput, seconds: 0.2 };
    });
    return seen;
  }

  beforeEach(() => {
    vi.mocked(launchMergeTool).mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('merges a Unity asset from the versions given, hidden and with no fallback tool, reading nothing from cm', async () => {
    const seen = smartMergeEnds(0, `${UNITY_HEADER}merged\n`);
    const { service, commands } = mergeTools({}, SMART_MERGE);

    expect(await service.smartMerge(PREFAB)).toEqual({ kind: 'merged', text: `${UNITY_HEADER}merged\n` });
    expect(commands).toEqual([]);
    const [{ args, hidden, files }] = seen as [(typeof seen)[number]];
    expect(hidden).toBe(true);
    expect(args.slice(0, 5)).toEqual(['merge', '-h', '--force', '--fallback', 'none']);
    expect(args.slice(-4).map((file) => file.split(/[\\/]/).pop())).toEqual(['Player.BASE.prefab', 'Player.INCOMING.prefab', 'Player.YOURS.prefab', 'Player.prefab']);
    expect(files).toEqual([PREFAB.base, PREFAB.incoming, PREFAB.yours]);
  });

  it('never takes its half merge when it leaves conflicts', async () => {
    smartMergeEnds(2, `${UNITY_HEADER}base values where they disagree\n`);
    const { service } = mergeTools({}, SMART_MERGE);

    expect(await service.smartMerge(PREFAB)).toEqual({ kind: 'notMerged' });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('merges a file whose base revision was empty from an asset with no objects, as it refuses an empty base', async () => {
    const seen = smartMergeEnds(0, `${UNITY_HEADER}both\n`);
    const { service } = mergeTools({}, SMART_MERGE);

    await service.smartMerge({ ...PREFAB, base: '' });

    expect(seen[0]!.files[0]).toBe(UNITY_HEADER);
  });

  it('leaves the file to the tool when it can’t start or fails, and says why in the console', async () => {
    vi.mocked(launchMergeTool).mockRejectedValueOnce(new Error("Couldn't start UnityYAMLMerge: it is not there anymore"));
    const { service } = mergeTools({}, SMART_MERGE);

    expect(await service.smartMerge(PREFAB)).toEqual({ kind: 'notMerged' });
    smartMergeEnds(1, '', "Error parsing file 'Player.BASE.prefab'");
    expect(await service.smartMerge(PREFAB)).toEqual({ kind: 'notMerged' });

    expect(vi.mocked(console.warn).mock.calls.map((call) => call.join(' '))).toEqual([
      "[smart merge] Assets/Player.prefab: Couldn't start UnityYAMLMerge: it is not there anymore",
      "[smart merge] Assets/Player.prefab: exit code 1 Error parsing file 'Player.BASE.prefab'",
    ]);
  });

  it('runs on a .meta file, which has no Unity header, and gives it back when it exits non-zero', async () => {
    const META = 'fileFormatVersion: 2\nguid: 1\n';
    const seen = smartMergeEnds(1, '');
    const { service } = mergeTools({}, SMART_MERGE);

    expect(await service.smartMerge({ ...PREFAB, path: 'Assets/Player.prefab.meta', base: '', yours: META, incoming: META })).toEqual({ kind: 'notMerged' });
    expect(seen).toHaveLength(1);
    expect(seen[0]!.files[0]).toBe('');
  });

  it('runs nothing without a Unity Editor, or on sides that aren’t Unity assets', async () => {
    smartMergeEnds(0, 'never');
    const withoutUnity = mergeTools({}).service;
    const withUnity = mergeTools({}, SMART_MERGE).service;

    expect(await withoutUnity.smartMerge(PREFAB)).toEqual({ kind: 'notMerged' });
    expect(await withUnity.smartMerge({ ...PREFAB, yours: 'fileFormatVersion: 2\n' })).toEqual({ kind: 'notMerged' });
    expect(await withUnity.smartMerge({ ...PREFAB, path: 'Assets/notes.txt', yours: 'a\n', incoming: 'b\n' })).toEqual({ kind: 'notMerged' });
    expect(launchMergeTool).not.toHaveBeenCalled();
  });

  it('stops when the user stops it', async () => {
    let started: () => void = () => undefined;
    const smartMergeStarted = new Promise<void>((resolve) => (started = resolve));
    vi.mocked(launchMergeTool).mockImplementation((_executable, _args, signal) => {
      started();
      return new Promise((resolve) => signal.addEventListener('abort', () => resolve({ exitCode: null, errorOutput: '', seconds: 1 })));
    });
    const { service } = mergeTools({}, SMART_MERGE);

    const merging = service.smartMerge(PREFAB);
    await smartMergeStarted;
    await service.stopWaiting(PREFAB.sessionId);

    expect(await merging).toEqual({ kind: 'stopped' });
  });

  it('says it was stopped when the user stops it as it exits on its own, so no tool opens after', async () => {
    let started: () => void = () => undefined;
    const smartMergeStarted = new Promise<void>((resolve) => (started = resolve));
    vi.mocked(launchMergeTool).mockImplementation((_executable, _args, signal) => {
      started();
      // It ends with its own exit code (conflicts left), the stop arriving too late to kill it.
      return new Promise((resolve) => signal.addEventListener('abort', () => resolve({ exitCode: 2, errorOutput: '', seconds: 1 })));
    });
    const { service } = mergeTools({}, SMART_MERGE);

    const merging = service.smartMerge(PREFAB);
    await smartMergeStarted;
    await service.stopWaiting(PREFAB.sessionId);

    expect(await merging).toEqual({ kind: 'stopped' });
  });

  it('starts merge tools with their window shown', async () => {
    vi.mocked(launchMergeTool).mockResolvedValue({ exitCode: 0, errorOutput: '', seconds: 30 });
    const { service } = mergeTools({ cat: CAT_VERSIONS }, SMART_MERGE);

    await service.resolve(WORKSPACE, REQUEST);

    expect(vi.mocked(launchMergeTool).mock.calls.map(([executable, , , options]) => [executable, options?.hidden ?? false])).toEqual([[MY_TOOL.executable, false]]);
  });

  it('lists every editor’s UnityYAMLMerge apart from the tools that open a window', async () => {
    const { service } = mergeTools({}, SMART_MERGE, OLDER);

    const { tools, unityYamlMerges } = await service.list();
    expect(unityYamlMerges).toEqual([SMART_MERGE, OLDER]);
    expect(tools.map((tool) => tool.executable)).not.toContain(SMART_MERGE.executable);
  });

  it('runs the newest editor’s, or the one editor’s a rule names, and none for an editor no longer installed', async () => {
    smartMergeEnds(0, `${UNITY_HEADER}merged\n`);
    const { service } = mergeTools({}, SMART_MERGE, OLDER);

    await service.smartMerge(PREFAB);
    await service.smartMerge({ ...PREFAB, toolId: 'unityyamlmerge:2022.3.10f1' });
    expect(await service.smartMerge({ ...PREFAB, toolId: 'unityyamlmerge:2019.4.0f1' })).toEqual({ kind: 'notMerged' });

    expect(vi.mocked(launchMergeTool).mock.calls.map(([executable]) => executable)).toEqual([SMART_MERGE.executable, OLDER.executable]);
  });
});
