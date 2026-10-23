import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommandLogEntry } from '@shared/events';
import { CmClient, OPENING_SHOW_MS, type CmRunners } from './CmClient';
import { CmShellPool } from './CmShellPool';
import { CmError } from './CmError';
import { MAX_LOGGED_COMMAND_LINE } from '@shared/clipForLog';
import type { CmResult } from './CmResult';
import { RecordReader } from './formatRecords';
import { CmOutputTooLargeError, textLimitOf } from './outputLimit';
import type { OutputReading } from './outputReading';
import { formatOutput } from './testing/cmOutput';
import { MAX_QUICK_WRITE_PATHS } from './longCommands';
import type { CmProcessOptions } from './runCmProcess';
import { SHELL_ARGS } from './shellCommandLine';
import { XmlElementReader } from './XmlElementReader';

const CM_PATH = join('opt', 'plasticscm', 'cm');
const asFields = (fields: string[]) => fields;
const WORKSPACE = join(homedir(), 'wkspaces', 'game');
/** Created on first use, so it's under the run's own temp folder (`vitest.tempDirectory.ts`). */
const OUTSIDE_WORKSPACES = join(tmpdir(), 'outside-workspaces');

interface ProcessRun {
  cmPath: string;
  args: string[];
  options: CmProcessOptions;
}

type Answer = (options?: CmProcessOptions) => CmResult;

/** A `CmClient` over fake runners: every process and shell command is recorded and answered with `answer`. */
function fakeClient({ warm = true, platform = 'linux' as NodeJS.Platform, answer = ((): CmResult => ({ output: 'done\n', exitCode: 0 })) as Answer, outsideWorkspaces = OUTSIDE_WORKSPACES } = {}) {
  const processes: ProcessRun[] = [];
  const shellCommands: { cwd: string; args: string[] }[] = [];
  const shellReadings: (OutputReading | undefined)[] = [];
  const pools: { cmPath: string; disposed: boolean; shown: string[]; warmed: string[]; released: string[] }[] = [];
  const runners: CmRunners = {
    runProcess: async (cmPath, args, options) => {
      processes.push({ cmPath, args, options });
      return printed(answer(options), options.reading);
    },
    createShellPool: (cmPath) => {
      const pool = { cmPath, disposed: false, shown: [] as string[], warmed: [] as string[], released: [] as string[] };
      pools.push(pool);
      return {
        run: async (cwd, args, reading) => {
          shellCommands.push({ cwd, args });
          shellReadings.push(reading);
          return printed(answer(), reading);
        },
        isReady: () => warm,
        shownDirectory: () => pool.shown.find((cwd) => !pool.released.includes(cwd)),
        show: (cwd) => void pool.shown.push(cwd),
        warmUp: (cwd) => void pool.warmed.push(cwd),
        release: (cwd) => void pool.released.push(cwd),
        disposeAll: () => void (pool.disposed = true),
      };
    },
  };
  const cm = new CmClient(() => CM_PATH, outsideWorkspaces, platform, runners);
  const logged: CommandLogEntry[] = [];
  cm.onCommandLogged((entry) => logged.push(entry));
  return { cm, processes, shellCommands, shellReadings, pools, logged };
}

/** What a runner gives for a command that printed `result.output`: streamed, its reader reads it, and the rest is its output. */
function printed(result: CmResult, reading: OutputReading | undefined): CmResult {
  if (!reading || !('stream' in reading)) return result;
  reading.stream.read(Buffer.from(result.output, 'utf8'));
  return { output: reading.stream.takeRest(), exitCode: result.exitCode };
}

/** The `CmError` a command fails with. */
async function failureOf(run: Promise<unknown>): Promise<CmError> {
  const error = await run.then(() => undefined, (caught: unknown) => caught);
  expect(error).toBeInstanceOf(CmError);
  return error as CmError;
}

describe('CmClient routing', () => {
  afterEach(() => vi.useRealTimers());

  it('answers a quick read from a warm pooled cm shell, in the given workspace', async () => {
    const { cm, processes, shellCommands } = fakeClient();

    expect(await cm.query(['whoami'], { cwd: WORKSPACE })).toBe('done\n');

    expect(shellCommands).toEqual([{ cwd: WORKSPACE, args: ['whoami'] }]);
    expect(processes).toEqual([]);
  });

  it('runs a query in the home directory when no workspace is given', async () => {
    const { cm, shellCommands } = fakeClient();

    await cm.query(['whoami']);

    expect(shellCommands[0]?.cwd).toBe(homedir());
  });

  it('runs a query that answers the same anywhere in a workspace a window shows, starting no sessions in the home directory', async () => {
    const { cm, shellCommands, pools } = fakeClient();
    cm.show(WORKSPACE);

    await cm.query(['whoami'], { anyDirectory: true });

    expect(shellCommands).toEqual([{ cwd: WORKSPACE, args: ['whoami'] }]);
    expect(pools[0]?.warmed).not.toContain(homedir());
  });

  it('runs a query that answers the same anywhere in the home directory when no window shows a workspace', async () => {
    const { cm, shellCommands } = fakeClient();
    await cm.query(['status', '--header'], { cwd: WORKSPACE });
    shellCommands.length = 0;

    await cm.query(['whoami'], { anyDirectory: true });

    expect(shellCommands).toEqual([{ cwd: homedir(), args: ['whoami'] }]);
  });

  it('runs a query that answers the same anywhere in the home directory while the workspace warmed up at launch is not watched', async () => {
    const { cm, shellCommands } = fakeClient();
    // The first window's workspace, warmed up before its page says it shows it: a broken or missing one never does.
    cm.warmUp(WORKSPACE);

    await cm.query(['whoami'], { anyDirectory: true });

    expect(shellCommands).toEqual([{ cwd: homedir(), args: ['whoami'] }]);
  });

  it('runs a query that answers the same anywhere in the workspace the first window opens, then home if it never watches it', async () => {
    vi.useFakeTimers();
    const ranIn: string[] = [];
    const session = (cwd: string) => ({
      pendingCount: 0,
      isReady: true,
      start: async () => undefined,
      run: async () => (ranIn.push(cwd), { output: '', exitCode: 0 }),
      dispose: () => undefined,
    });
    const runProcess = async () => ({ output: '', exitCode: 0 });
    const cm = new CmClient(() => CM_PATH, OUTSIDE_WORKSPACES, 'linux', { runProcess, createShellPool: (cmPath) => new CmShellPool(cmPath, session) });

    cm.showWhileOpening(WORKSPACE);
    await cm.query(['whoami'], { anyDirectory: true });
    // Its page found it broken, and went to the home screen.
    vi.advanceTimersByTime(OPENING_SHOW_MS);
    await cm.query(['whoami'], { anyDirectory: true });

    expect(ranIn).toEqual([WORKSPACE, homedir()]);
    cm.dispose();
  });

  it("runs a command naming its repository in the app's folder outside every workspace, even with one shown, creating it", async () => {
    const { cm, shellCommands, processes, logged } = fakeClient();
    cm.show(WORKSPACE);

    await cm.queryRecords(['find', 'branch', "on repository 'game@local'"], asFields, { outsideWorkspaces: true });
    await cm.executeRecords(['diff', 'br:/main@game@local'], asFields, { outsideWorkspaces: true });
    await cm.query(['status', '--header'], { cwd: WORKSPACE });

    expect(shellCommands.map(({ cwd }) => cwd)).toEqual([OUTSIDE_WORKSPACES, WORKSPACE]);
    expect(processes.map(({ options }) => options.cwd)).toEqual([OUTSIDE_WORKSPACES]);
    expect(existsSync(OUTSIDE_WORKSPACES)).toBe(true);
    // The log tells them apart, for the window exploring the repository to show its own (`ranInPlace`).
    expect(logged.map((entry) => entry.outsideWorkspaces ?? false)).toEqual([true, true, false]);
  });

  it('makes the folder outside every workspace again for a new process when it was deleted during the session', async () => {
    const outsideWorkspaces = join(mkdtempSync(join(tmpdir(), 'cm-client-')), 'outside-workspaces');
    const { cm, processes } = fakeClient({ outsideWorkspaces });
    await cm.executeRecords(['diff', 'br:/main@game@local'], asFields, { outsideWorkspaces: true });

    rmSync(outsideWorkspaces, { recursive: true });
    await cm.executeRecords(['diff', 'br:/task@game@local'], asFields, { outsideWorkspaces: true });

    expect(existsSync(outsideWorkspaces)).toBe(true);
    expect(processes.map(({ options }) => options.cwd)).toEqual([outsideWorkspaces, outsideWorkspaces]);
  });

  it('runs a query as a process of its own while no session of the directory is ready yet, and warms them up', async () => {
    const { cm, processes, shellCommands, pools } = fakeClient({ warm: false });

    await cm.query(['whoami'], { cwd: WORKSPACE });

    expect(shellCommands).toEqual([]);
    expect(processes).toMatchObject([{ cmPath: CM_PATH, args: ['whoami'], options: { cwd: WORKSPACE } }]);
    expect(pools[0]?.warmed).toEqual([WORKSPACE]);
  });

  it.each([
    ['cancellable', { signal: new AbortController().signal }],
    ['streamed', { onOutputLine: () => undefined }],
  ])('runs a %s query as a process of its own', async (_kind, options) => {
    const { cm, processes, shellCommands } = fakeClient();

    await cm.query(['fileinfo', 'a.cs'], options);

    expect(shellCommands).toEqual([]);
    expect(processes).toHaveLength(1);
  });

  it('runs a query whose arguments hold a quote or a line break as a process: a shell line cannot carry them', async () => {
    const { cm, processes, shellCommands } = fakeClient();

    await cm.query(['changeset', 'editcomment', 'cs:12', 'Fix the "jump" bug']);
    await cm.query(['changeset', 'editcomment', 'cs:12', 'First line\nSecond line']);

    expect(shellCommands).toEqual([]);
    expect(processes.map((run) => run.args.at(-1))).toEqual(['Fix the "jump" bug', 'First line\nSecond line']);
  });

  it.each([
    ['a transfer, however few files it names', ['checkin', join(WORKSPACE, 'a.cs')]],
    ['a recursive workspace write', ['undo', '-r', WORKSPACE]],
    ['a workspace write of many paths', ['undo', ...Array.from({ length: MAX_QUICK_WRITE_PATHS + 1 }, (_, i) => join(WORKSPACE, `f${i}.cs`))]],
  ])('keeps %s out of the pooled sessions', async (_kind, args) => {
    const { cm, processes, shellCommands } = fakeClient();

    await cm.query(args, { cwd: WORKSPACE });

    expect(shellCommands).toEqual([]);
    expect(processes).toHaveLength(1);
  });

  it('keeps an undo of a few files in the pooled sessions', async () => {
    const { cm, shellCommands } = fakeClient();

    await cm.query(['undo', join(WORKSPACE, 'a.cs'), join(WORKSPACE, 'b.cs')], { cwd: WORKSPACE });

    expect(shellCommands).toHaveLength(1);
  });

  it('always runs an execute as a process of its own, even with a warm pool', async () => {
    const { cm, processes, shellCommands } = fakeClient();

    await cm.execute(['version']);

    expect(shellCommands).toEqual([]);
    expect(processes).toMatchObject([{ args: ['version'], options: { cwd: homedir() } }]);
  });

  it('hands the process the cancellation signal, its kill signal and the output line listener', async () => {
    const { cm, processes } = fakeClient();
    const signal = new AbortController().signal;
    const onOutputLine = vi.fn();

    await cm.execute(['update'], { cwd: WORKSPACE, signal, killSignal: 'SIGKILL', onOutputLine });

    expect(processes[0]?.options).toEqual({ cwd: WORKSPACE, signal, killSignal: 'SIGKILL', onOutputLine, reading: { text: textLimitOf('operation') } });
  });
});

describe('CmClient command line too long for a process', () => {
  const manyPaths = Array.from({ length: 2000 }, (_, i) => join(WORKSPACE, 'Assets', 'Textures', `texture_${i}.png`));

  it('sends a checkin of thousands of paths through a cm shell of its own, as one command', async () => {
    const { cm, processes } = fakeClient({ answer: () => ({ output: 'CHANGESET cs:42@game@local\nCommandResult 0\n', exitCode: 0 }) });

    const output = await cm.execute(['checkin', ...manyPaths], { cwd: WORKSPACE });

    expect(processes).toHaveLength(1);
    expect(processes[0]?.args).toEqual(SHELL_ARGS);
    expect(processes[0]?.options.input).toBe(`checkin ${manyPaths.join(' ')}\nexit\n`);
    expect(output).toBe('CHANGESET cs:42@game@local\n');
  });

  it("streams the shell's output lines without its CommandResult line", async () => {
    const lines: string[] = [];
    const { cm } = fakeClient({
      answer: (options) => {
        options?.onOutputLine?.('Uploading');
        options?.onOutputLine?.('CommandResult 0');
        return { output: 'Uploading\nCommandResult 0\n', exitCode: 0 };
      },
    });

    await cm.execute(['checkin', ...manyPaths], { cwd: WORKSPACE, onOutputLine: (line) => lines.push(line) });

    expect(lines).toEqual(['Uploading']);
  });

  it("fails with the shell's command result when the command fails there", async () => {
    const { cm } = fakeClient({ answer: () => ({ output: 'Error: The item is locked.\nCommandResult 1\n', exitCode: 0 }) });

    await expect(cm.execute(['checkin', ...manyPaths], { cwd: WORKSPACE })).rejects.toMatchObject({
      message: 'The item is locked.',
      command: { exitCode: 1 },
    });
  });

  it('runs a text-printing process as a cm shell of its own on Windows, where a process prints in the console code page', async () => {
    const { cm, processes } = fakeClient({ platform: 'win32', answer: () => ({ output: 'Ñandú.txt\nCommandResult 0\n', exitCode: 0 }) });

    const output = await cm.execute(['getworkspacefrompath', 'Ñandú.txt', '--format={wkpath}'], { cwd: WORKSPACE });

    expect(processes[0]?.args).toEqual(SHELL_ARGS);
    expect(output).toBe('Ñandú.txt\n');
  });
});

describe('CmClient records', () => {
  const BRANCHES = formatOutput(['3', '/main'], ['37', '/main/tarea-ñ']);
  const toBranch = ([id = '', name = '']: string[]) => ({ id: Number(id), name });
  const listing = (output: string, exitCode = 0) => fakeClient({ answer: () => ({ output, exitCode }) });

  it('reads the records of a quick command from a warm pooled cm shell into what its caller builds of them', async () => {
    const { cm, shellCommands, processes, logged } = listing(BRANCHES);

    const branches = await cm.queryRecords(['find', 'branch', '--format=x'], toBranch, { cwd: WORKSPACE });

    expect(branches).toEqual([
      { id: 3, name: '/main' },
      { id: 37, name: '/main/tarea-ñ' },
    ]);
    expect(shellCommands).toEqual([{ cwd: WORKSPACE, args: ['find', 'branch', '--format=x', '--encoding=utf-8'] }]);
    expect(processes).toEqual([]);
    expect(logged).toMatchObject([{ commandLine: 'cm find branch --format=x --encoding=utf-8', exitCode: 0, viaShell: true, output: '' }]);
  });

  it('reads them from a process of its own while the pool is cold, as a query would run', async () => {
    const { cm, processes, shellCommands } = fakeClient({ warm: false, answer: () => ({ output: BRANCHES, exitCode: 0 }) });

    await expect(cm.queryRecords(['find', 'branch'], toBranch, { cwd: WORKSPACE })).resolves.toHaveLength(2);

    expect(shellCommands).toEqual([]);
    expect(processes[0]?.options.reading).toEqual({ stream: expect.any(RecordReader) });
  });

  it('reads the records of a slow command from a process of its own', async () => {
    const { cm, processes, shellCommands } = listing(formatOutput(['merge', '2', '5']));

    const merges = await cm.executeRecords(['find', 'merge'], ([type]) => type, { cwd: WORKSPACE });

    expect(merges).toEqual(['merge']);
    expect(shellCommands).toEqual([]);
    expect(processes.map(({ args }) => args)).toEqual([['find', 'merge', '--encoding=utf-8']]);
  });

  it('reads them from a cm shell of its own on Windows, its result line left out', async () => {
    const { cm, processes } = fakeClient({ platform: 'win32', warm: false, answer: () => ({ output: `${BRANCHES}CommandResult 0\n`, exitCode: 0 }) });

    const items = await cm.queryRecords(['ls', '--format=x'], toBranch, { cwd: WORKSPACE });

    expect(processes[0]?.args).toEqual(SHELL_ARGS);
    expect(items).toHaveLength(2);
  });

  it("fails with a CmError explained by the command's error, which the log shows", async () => {
    const error = 'Error: The branch br:/main/gone does not exist.\n';
    const { cm, logged } = listing(error, 1);

    await expect(failureOf(cm.queryRecords(['find', 'branch'], toBranch))).resolves.toMatchObject({
      message: 'The branch br:/main/gone does not exist.',
      command: { exitCode: 1, output: error.trim() },
    });
    expect(logged).toMatchObject([{ exitCode: 1, output: error.trim() }]);
  });

  it('fails with the result of a cm shell of its own when the command fails there', async () => {
    const { cm } = fakeClient({ platform: 'win32', warm: false, answer: () => ({ output: 'Error: The path is not in a workspace.\nCommandResult 1\n', exitCode: 0 }) });

    await expect(failureOf(cm.queryRecords(['ls', '--format=x'], toBranch))).resolves.toMatchObject({
      message: 'The path is not in a workspace.',
      command: { exitCode: 1 },
    });
  });
});

describe('CmClient output', () => {
  it('refuses to read a list as one string, before running anything or warming a session up', async () => {
    const { cm, processes, shellCommands, pools } = fakeClient();

    await expect(cm.query(['find', 'branch'], { cwd: WORKSPACE })).rejects.toThrow('cm find branch prints a list');
    await expect(cm.execute(['diff', 'cs:12'], { cwd: WORKSPACE })).rejects.toThrow('cm diff cs:12 prints a list');

    expect(processes).toEqual([]);
    expect(shellCommands).toEqual([]);
    expect(pools[0]?.warmed).toEqual([]);
  });

  it('refuses a command no one said how to read', async () => {
    const { cm, processes } = fakeClient();

    await expect(cm.execute(['purge', 'register'])).rejects.toThrow("cm purge register isn't in COMMAND_OUTPUTS");
    expect(processes).toEqual([]);
  });

  it("reads an answer whole, stopped past its limit, and keeps an operation's ends, in the shell and in a process", async () => {
    const { cm, processes, shellReadings } = fakeClient();

    await cm.query(['whoami']);
    await cm.query(['undo', 'a.cs'], { cwd: WORKSPACE });
    await cm.execute(['version']);
    await cm.execute(['update'], { cwd: WORKSPACE });

    expect(shellReadings).toEqual([{ text: textLimitOf('answer') }, { text: textLimitOf('operation') }]);
    expect(processes.map(({ options }) => options.reading)).toEqual([{ text: textLimitOf('answer') }, { text: textLimitOf('operation') }]);
  });

  it('reads the elements of an XML list as they arrive, into what its caller builds of each', async () => {
    const history = '<RevisionHistoriesResult><RevisionHistories><RevisionHistory><Revisions><Revision><ChangesetNumber>3</ChangesetNumber></Revision><Revision><ChangesetNumber>7</ChangesetNumber></Revision></Revisions></RevisionHistory></RevisionHistories></RevisionHistoriesResult>';
    const { cm, shellReadings } = fakeClient({ answer: () => ({ output: history, exitCode: 0 }) });

    const changesets = await cm.queryXmlElements(['history', 'a.cs', '--xml'], 'Revision', (revision) => revision.ChangesetNumber, { cwd: WORKSPACE });

    expect(changesets).toEqual(['3', '7']);
    expect(shellReadings).toEqual([{ stream: expect.any(XmlElementReader) }]);
  });
});

describe('CmClient arguments', () => {
  it('asks find and --xml output for UTF-8, in the shell and in a process', async () => {
    const { cm, processes, shellCommands } = fakeClient();

    await cm.queryRecords(['find', 'branch'], asFields);
    await cm.execute(['status', '--header', '--xml']);

    expect(shellCommands[0]?.args).toEqual(['find', 'branch', '--encoding=utf-8']);
    expect(processes[0]?.args).toEqual(['status', '--header', '--xml', '--encoding=utf-8']);
  });

  it('passes local paths decomposed on macOS, as cm reads them, and branch names as written', async () => {
    const macWorkspace = '/Users/jane/wkspaces/game';
    const composed = `${macWorkspace}/café.txt`;
    const { cm, shellCommands } = fakeClient({ platform: 'darwin' });

    await cm.query(['add', composed, 'br:/main/café'], { cwd: macWorkspace });

    expect(shellCommands[0]?.args).toEqual(['add', composed.normalize('NFD'), 'br:/main/café']);
  });

  it('passes local paths as written on other systems', async () => {
    const composed = join(WORKSPACE, 'café.txt');
    const { cm, shellCommands } = fakeClient({ platform: 'linux' });

    await cm.query(['add', composed], { cwd: WORKSPACE });

    expect(shellCommands[0]?.args).toEqual(['add', composed]);
  });
});

describe('CmClient failures', () => {
  it('fails with a CmError naming the command, its exit code, its output and its log entry', async () => {
    const output = 'Searching for changed items...\nError: The branch br:/main/task1 does not exist.\n';
    const { cm, logged } = fakeClient({ answer: () => ({ output, exitCode: 1 }) });

    const error = await failureOf(cm.query(['switch', 'br:/main/task1'], { cwd: WORKSPACE }));

    expect(error).toMatchObject({
      message: 'The branch br:/main/task1 does not exist.',
      command: {
        commandLine: 'cm switch br:/main/task1',
        exitCode: 1,
        output: output.trim(),
        logEntryId: logged[0]?.id,
      },
    });
  });

  it('hides passwords in the error, its command line and the command log', async () => {
    const output = 'Error: Authentication failed for https://dani:s3cret@github.com/acme/game.git\n';
    const { cm, logged } = fakeClient({ answer: () => ({ output, exitCode: 1 }) });

    const error = await failureOf(cm.execute(['sync', 'game@local', 'git', 'https://github.com/acme/game.git', '--user=dani', '--pwd=s3cret']));

    const everythingShown = JSON.stringify([error.message, error.command, logged]);
    expect(everythingShown).not.toContain('s3cret');
    expect(error.command.commandLine).toBe('cm sync game@local git https://github.com/acme/game.git --user=dani --pwd=•••');
  });

  it('keeps the whole command line in the error while the log clips it', async () => {
    const paths = Array.from({ length: 300 }, (_, i) => join(WORKSPACE, `file_${i}.cs`));
    const { cm, logged } = fakeClient({ warm: false, answer: () => ({ output: 'Error: locked\n', exitCode: 1 }) });

    const error = await failureOf(cm.execute(['checkout', ...paths]));

    expect(error.command.commandLine).toBe(`cm checkout ${paths.join(' ')}`);
    expect(logged[0]?.commandLine.length).toBeLessThan(error.command.commandLine.length);
    expect(logged[0]?.commandLine.startsWith(error.command.commandLine.slice(0, MAX_LOGGED_COMMAND_LINE))).toBe(true);
  });
});

describe('CmClient commands that end without an exit code', () => {
  it('logs a command that could not run, and fails with its error', async () => {
    const notFound = new Error('spawn cm ENOENT');
    const { cm, logged } = fakeClient({
      answer: () => {
        throw notFound;
      },
    });

    await expect(cm.execute(['version'])).rejects.toBe(notFound);

    expect(logged).toMatchObject([{ commandLine: 'cm version', exitCode: -1, viaShell: false, output: 'spawn cm ENOENT' }]);
  });

  it('leaves out of the log a command its caller cancelled: no failure to point at', async () => {
    const cancelled = new AbortController();
    const { cm, logged } = fakeClient({
      answer: () => {
        cancelled.abort();
        throw new Error('The operation was aborted');
      },
    });

    await expect(cm.execute(['update'], { signal: cancelled.signal })).rejects.toThrow('aborted');

    expect(logged).toEqual([]);
  });

  it('logs a pooled command its session stopped', async () => {
    const { cm, logged } = fakeClient({
      answer: () => {
        throw new Error('cm is waiting for input ("Password:").');
      },
    });

    await expect(cm.query(['fileinfo', 'a.cs', '--xml'])).rejects.toThrow('waiting for input');

    expect(logged).toMatchObject([{ exitCode: -1, viaShell: true, output: 'cm is waiting for input ("Password:").' }]);
  });

  it('fails a command whose output was too large to read with a CmError naming it, to report from its details', async () => {
    const { cm, logged } = fakeClient({
      answer: () => {
        throw new CmOutputTooLargeError(4 * 1024 * 1024);
      },
    });

    const error = await failureOf(cm.query(['fileinfo', 'a.cs', '--xml'], { cwd: WORKSPACE }));

    expect(error).toMatchObject({
      message: 'The command printed more than 4 MB, too much to read, and was stopped.',
      command: { commandLine: 'cm fileinfo a.cs --xml --encoding=utf-8', exitCode: -1, logEntryId: logged[0]?.id },
    });
  });
});

describe('CmClient command log', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T10:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('logs every command once, numbered, with where and how it ran and no output when it succeeded', async () => {
    const { cm, logged } = fakeClient();

    await cm.query(['whoami'], { cwd: WORKSPACE });
    await cm.execute(['version']);

    expect(logged).toEqual([
      { id: 1, commandLine: 'cm whoami', cwd: WORKSPACE, startedAt: Date.now(), durationMs: 0, exitCode: 0, viaShell: true, output: '' },
      { id: 2, commandLine: 'cm version', cwd: homedir(), startedAt: Date.now(), durationMs: 0, exitCode: 0, viaShell: false, output: '' },
    ]);
  });

  it('logs the command as cm ran it', async () => {
    const { cm, logged } = fakeClient();

    await cm.query(['fileinfo', 'a.cs', '--xml']);

    expect(logged[0]?.commandLine).toBe('cm fileinfo a.cs --xml --encoding=utf-8');
  });

  it('logs a failed command with its output', async () => {
    const { cm, logged } = fakeClient({ answer: () => ({ output: '  Error: no such label\n', exitCode: 1 }) });

    await cm.query(['label', 'delete', 'lb:v1']).catch(() => undefined);

    expect(logged).toMatchObject([{ commandLine: 'cm label delete lb:v1', exitCode: 1, output: 'Error: no such label' }]);
  });

  it('stops logging to a listener once it unsubscribes', async () => {
    const { cm } = fakeClient();
    const listener = vi.fn();
    const unsubscribe = cm.onCommandLogged(listener);

    await cm.query(['whoami']);
    unsubscribe();
    await cm.query(['whoami']);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('tells start listeners each command as cm gets it, with its completion', async () => {
    const { cm } = fakeClient();
    const started: { args: readonly string[]; cwd: string; finished: Promise<unknown> }[] = [];
    cm.onCommandStarted((command) => started.push(command));

    await cm.query(['fileinfo', 'a.cs', '--xml'], { cwd: WORKSPACE });

    expect(started).toMatchObject([{ args: ['fileinfo', 'a.cs', '--xml', '--encoding=utf-8'], cwd: WORKSPACE }]);
    await expect(started[0]?.finished).resolves.toEqual({ output: 'done\n', exitCode: 0 });
  });
});

describe('CmClient sessions', () => {
  it('warms up, shows and releases the sessions of a directory, warming up the home directory by default', () => {
    const { cm, pools } = fakeClient();

    cm.warmUp();
    cm.show(WORKSPACE);
    cm.release(WORKSPACE);

    expect(pools[0]).toMatchObject({ warmed: [homedir()], shown: [WORKSPACE], released: [WORKSPACE] });
  });

  it('starts over with new sessions when cm is found somewhere else', async () => {
    const locations = [CM_PATH, join('usr', 'local', 'bin', 'cm')];
    const processes: string[] = [];
    const pools: { cmPath: string; disposed: boolean }[] = [];
    const cm = new CmClient(() => locations[0]!, OUTSIDE_WORKSPACES, 'linux', {
      runProcess: async (cmPath) => {
        processes.push(cmPath);
        return { output: '', exitCode: 0 };
      },
      createShellPool: (cmPath) => {
        const pool = { cmPath, disposed: false };
        pools.push(pool);
        return { run: vi.fn(), isReady: () => false, shownDirectory: () => undefined, show: vi.fn(), warmUp: vi.fn(), release: vi.fn(), disposeAll: () => void (pool.disposed = true) };
      },
    });

    cm.relocate();
    expect(pools).toEqual([{ cmPath: CM_PATH, disposed: false }]);

    locations.shift();
    cm.relocate();
    await cm.execute(['version']);

    expect(pools).toEqual([
      { cmPath: CM_PATH, disposed: true },
      { cmPath: locations[0], disposed: false },
    ]);
    expect(cm.executable).toBe(locations[0]);
    expect(processes).toEqual([locations[0]]);
  });

  it('ends every session on dispose', () => {
    const { cm, pools } = fakeClient();

    cm.dispose();

    expect(pools[0]?.disposed).toBe(true);
  });
});
