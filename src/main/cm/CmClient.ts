import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import type { CommandLogEntry } from '@shared/events';
import { CmError } from './CmError';
import { clipForLog, MAX_LOGGED_COMMAND_LINE, MAX_LOGGED_OUTPUT } from '@shared/clipForLog';
import { inCmPathForm } from './cmPathForm';
import type { CmResult } from './CmResult';
import { CmShellPool } from './CmShellPool';
import { extractErrorMessage } from './errorMessage';
import { RecordReader, type ReadRecord } from './formatRecords';
import { commandLineForLog, outputForLog } from './hideSecrets';
import { runsLong } from './longCommands';
import { CmOutputTooLargeError } from './outputLimit';
import { processCommand } from './processCommand';
import { runCmProcess } from './runCmProcess';
import { canRunInShell } from './shellCommandLine';
import { isShellResultLine, shellCommandResult } from './shellResultLine';
import { withUtf8Output } from './utf8Output';

export interface CmRunOptions {
  /** Working directory; `cm` resolves the workspace and repository from it. */
  cwd?: string;
  /**
   * A local command that answers the same in any directory (`profile list`, `whoami`, `workspace list`): with no `cwd`,
   * it runs in a workspace a window watches (`show`, `shownDirectory`) instead of starting the home folder's
   * `cm shell`s, two more processes of about 80 MB each. The home folder's when only the home screen shows.
   */
  anyDirectory?: boolean;
  /**
   * A command that names its repository itself (a repository explored without a workspace, `cmPlace`): with no `cwd`,
   * it runs in a folder of the app's that no workspace holds, so one that forgot to name it fails ("Not on workspace")
   * instead of reading or changing the repository of a workspace it happened to run in.
   */
  outsideWorkspaces?: boolean;
  signal?: AbortSignal;
  /** Signal sent to the process when `signal` aborts (default SIGTERM). */
  killSignal?: NodeJS.Signals;
  onOutputLine?: (line: string) => void;
}

/** How a command printing `--format` records runs: as any other, but with no output lines to report. */
export type CmRecordsOptions = Omit<CmRunOptions, 'onOutputLine'>;

type CommandLogListener = (entry: CommandLogEntry) => void;
type ShellPool = Pick<CmShellPool, 'run' | 'isReady' | 'shownDirectory' | 'show' | 'warmUp' | 'release' | 'disposeAll'>;

/** What `CmClient` runs commands with: a process of their own, and pooled `cm shell` sessions. Tests pass fakes. */
export interface CmRunners {
  runProcess: typeof runCmProcess;
  createShellPool: (cmPath: string) => ShellPool;
}

const CM_RUNNERS: CmRunners = { runProcess: runCmProcess, createShellPool: (cmPath) => new CmShellPool(cmPath) };
/** Long enough for a slow machine's first window to watch its workspace; a page that never does stops counting after. */
export const OPENING_SHOW_MS = 30_000;

type CommandStartedListener = (command: { args: readonly string[]; cwd: string; finished: Promise<unknown> }) => void;

/**
 * The single entry point to the `cm` CLI.
 * Quick commands reuse pooled `cm shell` sessions: a warm one answers in a few ms, where starting a `cm` process costs
 * 100-150 ms before the command even runs. Commands that may run long, stream progress or can be cancelled run as
 * dedicated processes, so they never hold a pooled session that reads are waiting for.
 */
export class CmClient {
  private cmPath: string;
  private shellPool: ShellPool;
  private readonly logListeners = new Set<CommandLogListener>();
  private readonly startListeners = new Set<CommandStartedListener>();
  private nextCommandId = 1;

  /**
   * `locate` finds the `cm` executable; it runs again on `relocate()`. `outsideWorkspaces` is an empty folder of the
   * app's, in no workspace, made as it's used (`CmRunOptions.outsideWorkspaces`).
   */
  constructor(
    private readonly locate: () => string,
    private readonly outsideWorkspaces: string,
    private readonly platform: NodeJS.Platform = process.platform,
    private readonly runners: CmRunners = CM_RUNNERS,
  ) {
    this.cmPath = locate();
    this.shellPool = runners.createShellPool(this.cmPath);
  }

  /** Where `cm` was found: the official GUI and its merge tool are installed next to it. */
  get executable(): string {
    return this.cmPath;
  }

  /** Looks for `cm` again, e.g. after the user installed it while the app was running. */
  relocate(): void {
    const cmPath = this.locate();
    if (cmPath === this.cmPath) return;
    this.shellPool.disposeAll();
    this.cmPath = cmPath;
    this.shellPool = this.runners.createShellPool(cmPath);
  }

  onCommandLogged(listener: CommandLogListener): () => void {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  onCommandStarted(listener: CommandStartedListener): () => void {
    this.startListeners.add(listener);
    return () => this.startListeners.delete(listener);
  }

  /**
   * Runs a quick, non-interactive command (reads, small writes) in a pooled `cm shell`. A command that may run long
   * anyway (`runsLong`: a workspace write of many files) gets a process of its own, as does one before the pool is warm.
   */
  query(args: string[], options: CmRunOptions = {}): Promise<string> {
    const placed = this.placed(options);
    return this.run(args, placed, this.runsInPooledShell(args, placed));
  }

  /** Runs a long or cancellable command in its own process, streaming its output. */
  execute(args: string[], options: CmRunOptions = {}): Promise<string> {
    return this.run(args, this.placed(options), false);
  }

  /**
   * Runs a quick command that prints `--format` records (`recordFormat`), where `query` would, and reads each record
   * into what `readRecord` builds of its fields as it arrives (`RecordReader`): the output is never held whole, so a
   * big answer costs about what its rows weigh. Fails as `query` does.
   */
  queryRecords<T>(args: string[], readRecord: ReadRecord<T>, options: CmRecordsOptions = {}): Promise<T[]> {
    const placed = this.placed(options);
    return this.runRecords(args, readRecord, placed, this.runsInPooledShell(args, placed));
  }

  /** Runs a long or cancellable command that prints `--format` records in its own process, reading them as `queryRecords` does. */
  executeRecords<T>(args: string[], readRecord: ReadRecord<T>, options: CmRecordsOptions = {}): Promise<T[]> {
    return this.runRecords(args, readRecord, this.placed(options), false);
  }

  /** Prepares `cm shell` sessions for a working directory (defaults to the home directory). */
  warmUp(cwd = homedir()): void {
    this.shellPool.warmUp(cwd);
  }

  /**
   * A window watches the workspace in `cwd` (`workspaces.watch`): its sessions start, and queries that run the same
   * anywhere go there too (`anyDirectory`) until `release`. Only a watch shows a directory: a workspace warmed up at
   * launch whose page finds it broken or missing is never watched, so it never holds them.
   */
  show(cwd: string): void {
    this.shellPool.show(cwd);
  }

  /**
   * The first window opens the workspace in `cwd` at launch: its sessions start, and it counts as shown (`show`) before
   * its page watches it, so the launch's queries that run anywhere (the profiles read) start none in the home folder.
   * For `OPENING_SHOW_MS` at most: a workspace the page finds broken or missing is never watched.
   */
  showWhileOpening(cwd: string): void {
    this.shellPool.show(cwd, { forMs: OPENING_SHOW_MS });
  }

  /** Ends the `cm shell` sessions of a working directory no window shows anymore (each holds tens of MB). */
  release(cwd: string): void {
    this.shellPool.release(cwd);
  }

  dispose(): void {
    this.shellPool.disposeAll();
  }

  /** The options with the directory the command runs in (`directoryOf`). */
  private placed<T extends CmRunOptions>(options: T): T & { cwd: string } {
    return { ...options, cwd: this.directoryOf(options) };
  }

  /**
   * Where a command runs: its `cwd`; else, for one naming its repository, the folder outside every workspace; for a
   * query that runs the same anywhere, a directory a window shows; else home.
   */
  private directoryOf({ cwd, anyDirectory, outsideWorkspaces }: CmRunOptions): string {
    if (cwd !== undefined) return cwd;
    if (outsideWorkspaces) return this.outsideWorkspacesFolder();
    return (anyDirectory ? this.shellPool.shownDirectory() : undefined) ?? homedir();
  }

  /**
   * Made on every use, not once: the OS or the user may delete it during the session, and making it is a cheap check
   * once it exists. A process started then runs in it; a `cm shell` already pooled there keeps the folder it started in.
   */
  private outsideWorkspacesFolder(): string {
    mkdirSync(this.outsideWorkspaces, { recursive: true });
    return this.outsideWorkspaces;
  }

  /**
   * Whether a query goes to a pooled `cm shell`: not when it can be cancelled, streams its output, can't be written on
   * a shell line (`canRunInShell`) or may run long (`runsLong`). Any other warms the directory's sessions up, and runs
   * as a process of its own until one of them answers.
   */
  private runsInPooledShell(args: string[], { cwd = homedir(), signal, onOutputLine }: CmRunOptions): boolean {
    if (signal || onOutputLine || !canRunInShell(args) || runsLong(args)) return false;
    this.shellPool.warmUp(cwd);
    return this.shellPool.isReady(cwd);
  }

  /**
   * Runs the command with its records read by `readRecord`. What it printed besides them (its stderr, text after the
   * last record) is its output, which explains its failure and is no record.
   */
  private async runRecords<T>(args: string[], readRecord: ReadRecord<T>, options: CmRecordsOptions, useShell: boolean): Promise<T[]> {
    const records = new RecordReader(readRecord);
    await this.run(args, options, useShell, records);
    return records.finish();
  }

  /** Runs `cm <args>`, logs it and fails on an exit code other than 0; with `records`, its records go there as they arrive. */
  private async run(requested: string[], options: CmRunOptions, useShell: boolean, records?: RecordReader<unknown>): Promise<string> {
    const cwd = options.cwd ?? homedir();
    const args = withUtf8Output(inCmPathForm(requested, cwd, this.platform));
    const startedAt = Date.now();
    const log = (result: CmResult): CommandLogEntry => this.log(args, cwd, startedAt, result, useShell);
    const finished = useShell ? this.shellPool.run(cwd, args, records) : this.runProcess(args, cwd, options, records);
    this.startListeners.forEach((listener) => listener({ args, cwd, finished }));

    const result = await finished.catch((error: unknown) => {
      // A command its caller cancelled is no failure to log.
      if (options.signal?.aborted) throw error;
      const entry = log(endedWithoutExitCode(error));
      throw error instanceof CmOutputTooLargeError ? stoppedFailure(error, entry) : error;
    });
    const entry = log(result);
    if (result.exitCode !== 0) throw failure(result, entry);
    return result.output;
  }

  /** A process of its own; a command line too long to start one with (thousands of paths) goes to a `cm shell` of its own. */
  private async runProcess(args: string[], cwd: string, { signal, killSignal, onOutputLine }: CmRunOptions, records?: RecordReader<unknown>): Promise<CmResult> {
    const { args: started, input } = processCommand(args, this.platform);
    const { runProcess } = this.runners;
    if (input === undefined) return runProcess(this.cmPath, started, { cwd, signal, killSignal, onOutputLine, records });
    const outputLine = onOutputLine && ((line: string) => !isShellResultLine(line) && onOutputLine(line));
    const result = await runProcess(this.cmPath, started, { cwd, signal, killSignal, onOutputLine: outputLine, input, records });
    // A `cm shell` of its own ends its output with a result line; with records, the line follows the last of them.
    return shellCommandResult(result.output);
  }

  /**
   * Logs the command with its secrets hidden (`hideSecrets`) and clipped (`clipForLog`); returns it unclipped, for the
   * error that reports it: what reads the error in main may need all of it, and the window gets it clipped
   * (`registerApi`).
   */
  private log(args: string[], cwd: string, startedAt: number, result: CmResult, viaShell: boolean): CommandLogEntry {
    const commandLine = commandLineForLog(args);
    const output = result.exitCode === 0 ? '' : outputForLog(result.output.trim());
    const entry: CommandLogEntry = {
      id: this.nextCommandId++,
      commandLine,
      cwd,
      startedAt,
      durationMs: Date.now() - startedAt,
      exitCode: result.exitCode,
      viaShell,
      output,
    };
    const logged = { ...entry, commandLine: clipForLog(commandLine, MAX_LOGGED_COMMAND_LINE), output: clipForLog(output, MAX_LOGGED_OUTPUT, 'ends') };
    this.logListeners.forEach((listener) => listener(logged));
    return entry;
  }
}

/** What a command that ended without an exit code of its own (`cm` not found, a stalled prompt, a closed session) logs. */
function endedWithoutExitCode(error: unknown): CmResult {
  return { output: error instanceof Error ? error.message : String(error), exitCode: -1 };
}

/** A command the app stopped for a reason of its own (`CmOutputTooLargeError`), reported with its details as any failure. */
function stoppedFailure(error: Error, entry: CommandLogEntry): CmError {
  return new CmError(error.message, { commandLine: entry.commandLine, exitCode: entry.exitCode, output: entry.output, logEntryId: entry.id });
}

/** A command that exited with another code than 0, explained by the error line of its output. */
function failure(result: CmResult, entry: CommandLogEntry): CmError {
  return new CmError(outputForLog(extractErrorMessage(result.output)), {
    commandLine: entry.commandLine,
    exitCode: entry.exitCode,
    output: entry.output,
    logEntryId: entry.id,
  });
}
