import { homedir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommandLogEntry } from '@shared/events';
import { CmClient, type CmRunners } from './CmClient';
import { CmError } from './CmError';
import { MAX_LOGGED_COMMAND_LINE } from './clipForLog';
import type { CmResult } from './CmResult';
import { CmOutputTooLargeError } from './outputLimit';
import { MAX_QUICK_WRITE_PATHS } from './longCommands';
import type { CmProcessOptions } from './runCmProcess';
import { SHELL_ARGS } from './shellCommandLine';

const CM_PATH = join('opt', 'plasticscm', 'cm');
const WORKSPACE = join(homedir(), 'wkspaces', 'game');

interface ProcessRun {
  cmPath: string;
  args: string[];
  options: CmProcessOptions;
}

type Answer = (options?: CmProcessOptions) => CmResult;

/** A `CmClient` over fake runners: every process and shell command is recorded and answered with `answer`. */
function fakeClient({ warm = true, platform = 'linux' as NodeJS.Platform, answer = ((): CmResult => ({ output: 'done\n', exitCode: 0 })) as Answer } = {}) {
  const processes: ProcessRun[] = [];
  const shellCommands: { cwd: string; args: string[] }[] = [];
  const pools: { cmPath: string; disposed: boolean; warmed: string[]; released: string[] }[] = [];
  const runners: CmRunners = {
    runProcess: async (cmPath, args, options) => {
      processes.push({ cmPath, args, options });
      return answer(options);
    },
    createShellPool: (cmPath) => {
      const pool = { cmPath, disposed: false, warmed: [] as string[], released: [] as string[] };
      pools.push(pool);
      return {
        run: async (cwd, args) => {
          shellCommands.push({ cwd, args });
          return answer();
        },
        isReady: () => warm,
        warmUp: (cwd) => void pool.warmed.push(cwd),
        release: (cwd) => void pool.released.push(cwd),
        disposeAll: () => void (pool.disposed = true),
      };
    },
  };
  const cm = new CmClient(() => CM_PATH, platform, runners);
  const logged: CommandLogEntry[] = [];
  cm.onCommandLogged((entry) => logged.push(entry));
  return { cm, processes, shellCommands, pools, logged };
}

/** The `CmError` a command fails with. */
async function failureOf(run: Promise<string>): Promise<CmError> {
  const error = await run.then(() => undefined, (caught: unknown) => caught);
  expect(error).toBeInstanceOf(CmError);
  return error as CmError;
}

describe('CmClient routing', () => {
  it('answers a quick read from a warm pooled cm shell, in the given workspace', async () => {
    const { cm, processes, shellCommands } = fakeClient();

    expect(await cm.query(['whoami'], { cwd: WORKSPACE })).toBe('done\n');

    expect(shellCommands).toEqual([{ cwd: WORKSPACE, args: ['whoami'] }]);
    expect(processes).toEqual([]);
  });

  it('runs a query in the home directory when no workspace is given', async () => {
    const { cm, shellCommands } = fakeClient();

    await cm.query(['profile', 'list']);

    expect(shellCommands[0]?.cwd).toBe(homedir());
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

    await cm.query(['find', 'changeset', '--nototal'], options);

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

    expect(processes[0]?.options).toEqual({ cwd: WORKSPACE, signal, killSignal: 'SIGKILL', onOutputLine });
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

    const output = await cm.execute(['diff', 'cs:12', '--format={path}'], { cwd: WORKSPACE });

    expect(processes[0]?.args).toEqual(SHELL_ARGS);
    expect(output).toBe('Ñandú.txt\n');
  });
});

describe('CmClient arguments', () => {
  it('asks find and --xml output for UTF-8, in the shell and in a process', async () => {
    const { cm, processes, shellCommands } = fakeClient();

    await cm.query(['find', 'branch', '--xml']);
    await cm.execute(['status', '--xml']);

    expect(shellCommands[0]?.args).toEqual(['find', 'branch', '--xml', '--encoding=utf-8']);
    expect(processes[0]?.args).toEqual(['status', '--xml', '--encoding=utf-8']);
  });

  it('passes local paths decomposed on macOS, as cm reads them, and branch names as written', async () => {
    const macWorkspace = '/Users/dani/wkspaces/game';
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

    await expect(cm.query(['find', 'label', '--xml'])).rejects.toThrow('waiting for input');

    expect(logged).toMatchObject([{ exitCode: -1, viaShell: true, output: 'cm is waiting for input ("Password:").' }]);
  });

  it('fails a command whose output was too large to read with a CmError naming it, to report from its details', async () => {
    const { cm, logged } = fakeClient({
      answer: () => {
        throw new CmOutputTooLargeError(256 * 1024 * 1024);
      },
    });

    const error = await failureOf(cm.query(['find', 'changeset', "where branch = '/main'", '--xml'], { cwd: WORKSPACE }));

    expect(error).toMatchObject({
      message: 'The command printed more than 256 MB, too much to read, and was stopped.',
      command: { commandLine: "cm find changeset where branch = '/main' --xml", exitCode: -1, logEntryId: logged[0]?.id },
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

    await cm.query(['find', 'label', '--xml']);

    expect(logged[0]?.commandLine).toBe('cm find label --xml --encoding=utf-8');
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

    await cm.query(['find', 'label', '--xml'], { cwd: WORKSPACE });

    expect(started).toMatchObject([{ args: ['find', 'label', '--xml', '--encoding=utf-8'], cwd: WORKSPACE }]);
    await expect(started[0]?.finished).resolves.toEqual({ output: 'done\n', exitCode: 0 });
  });
});

describe('CmClient sessions', () => {
  it('warms up and releases the sessions of a directory, the home directory by default', () => {
    const { cm, pools } = fakeClient();

    cm.warmUp();
    cm.warmUp(WORKSPACE);
    cm.release(WORKSPACE);

    expect(pools[0]).toMatchObject({ warmed: [homedir(), WORKSPACE], released: [WORKSPACE] });
  });

  it('starts over with new sessions when cm is found somewhere else', async () => {
    const locations = [CM_PATH, join('usr', 'local', 'bin', 'cm')];
    const processes: string[] = [];
    const pools: { cmPath: string; disposed: boolean }[] = [];
    const cm = new CmClient(() => locations[0]!, 'linux', {
      runProcess: async (cmPath) => {
        processes.push(cmPath);
        return { output: '', exitCode: 0 };
      },
      createShellPool: (cmPath) => {
        const pool = { cmPath, disposed: false };
        pools.push(pool);
        return { run: vi.fn(), isReady: () => false, warmUp: vi.fn(), release: vi.fn(), disposeAll: () => void (pool.disposed = true) };
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
