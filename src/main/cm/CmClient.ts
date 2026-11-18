import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import type { CommandLogEntry } from '@shared/events';
import type { FailedCommand } from '@shared/ipc';
import type { SignInProblem, SignInProblemKind } from '@shared/domain/signIn';
import { CmError } from './CmError';
import { CmSignInError } from './CmSignInError';
import { WaitingForInputError } from './consolePrompts';
import { clipForLog, MAX_LOGGED_COMMAND_LINE, MAX_LOGGED_OUTPUT } from '@shared/clipForLog';
import { inCmPathForm } from './cmPathForm';
import type { CmResult } from './CmResult';
import { CmShellPool } from './CmShellPool';
import { textOutputKind } from './commandOutputs';
import { extractErrorMessage } from './errorMessage';
import { RecordReader, type ReadRecord } from './formatRecords';
import { commandLineForLog, outputForLog } from './hideSecrets';
import { runsLong } from './longCommands';
import { CmOutputTooLargeError, textLimitOf } from './outputLimit';
import type { OutputReading, StreamReader } from './outputReading';
import { processCommand } from './processCommand';
import { isServerCommand } from './repeatedCommands';
import { runCmProcess } from './runCmProcess';
import { canRunInShell } from './shellCommandLine';
import { signInFailureOf } from './signInFailure';
import { LineReader, type ReadLine } from './LineReader';
import { isShellResultLine, shellCommandResult } from './shellResultLine';
import { withUtf8Output } from './utf8Output';
import { XmlElementReader, type ReadElement } from './XmlElementReader';

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
  /**
   * The server the command works with, when it names one (`checkconnection <server>`, a repository's place: `cmPlace`).
   * A workspace's needs none: the sign-in gate knows it from the workspace's folder (`SignInGate.serverOf`).
   */
  server?: string;
  signal?: AbortSignal;
  /** Signal sent to the process when `signal` aborts (default SIGTERM). */
  killSignal?: NodeJS.Signals;
  onOutputLine?: (line: string) => void;
}

/** How a command whose list is streamed runs: as any other, but with no output lines to report. */
export type CmRecordsOptions = Omit<CmRunOptions, 'onOutputLine'>;

type CommandLogListener = (entry: CommandLogEntry) => void;
type ShellPool = Pick<CmShellPool, 'run' | 'isReady' | 'shownDirectory' | 'show' | 'warmUp' | 'release' | 'disposeAll' | 'restartSessions'>;

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
 * Keeps commands from a server that needs a sign-in, and tells one a command ran into (`SignInGate` in `main/accounts`,
 * docs/features/accounts.md "The gate").
 */
export interface SignInGate {
  /** The server a command works with: the one it names (`CmRunOptions.server`), or its workspace's; undefined when unknown. */
  serverOf(cwd: string, named: string | undefined): string | undefined;
  /**
   * The server of the workspace holding `cwd`, read now (a local read) for a command there that failed for a sign-in
   * before the gate knew it (`WorkspaceServers.learn`); undefined when `cwd` is in no workspace.
   */
  learnServerOf(cwd: string): Promise<string | undefined>;
  /** Whether a command goes by the gate unasked: the session check itself (`cm checkconnection`). */
  passes(args: readonly string[]): boolean;
  /** The problem that keeps server commands from `server`, or undefined when they may run. */
  refusal(server: string): SignInProblem | undefined;
  /**
   * A command to `server`, started at `commandStartedAt`, failed as a sign-in problem would: the server's problem once a
   * check of its session started since confirms it (`SessionChecks.confirm`), else null: the failure was another
   * server's (an xlink's) or no sign-in problem at all.
   */
  confirm(server: string, commandStartedAt: number): Promise<SignInProblem | null>;
}

/**
 * The single entry point to the `cm` CLI.
 * Quick commands reuse pooled `cm shell` sessions: a warm one answers in a few ms, where starting a `cm` process costs
 * 100-150 ms before the command even runs. Commands that may run long, stream progress or can be cancelled run as
 * dedicated processes, so they never hold a pooled session that reads are waiting for; an operation's is a `cm shell`
 * of its own, which exits after it (`processCommand`).
 */
export class CmClient {
  private cmPath: string;
  private shellPool: ShellPool;
  private readonly logListeners = new Set<CommandLogListener>();
  private readonly startListeners = new Set<CommandStartedListener>();
  private nextCommandId = 1;
  private signInGate: SignInGate | null = null;

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

  /**
   * Logs what isn't a command of `cm`'s beside them, numbered with them, to the same listeners: an issue tracker's
   * request (docs/features/issue-trackers.md, "The HTTP client").
   */
  logEntry(entry: Omit<CommandLogEntry, 'id'>): void {
    const logged = { ...entry, id: this.nextCommandId++ };
    this.logListeners.forEach((listener) => listener(logged));
  }

  /** From now on, commands go by `gate` (`SignInGate`): set once, as main wires its services. */
  gateSignIns(gate: SignInGate): void {
    this.signInGate = gate;
  }

  /**
   * Starts new `cm shell` sessions as the ones running finish their commands, in the same directories: a session keeps
   * the sign-in it read when it started, so after signing in again the old ones would still fail.
   */
  restartShells(): void {
    this.shellPool.restartSessions();
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
   * Its text is an answer's, whole, or an operation's, by its ends (`textOutputKind`); a list is refused: it takes
   * `queryRecords`.
   */
  query(args: string[], options: CmRunOptions = {}): Promise<string> {
    const placed = this.placed(options);
    return this.runText(args, placed, () => this.runsInPooledShell(args, placed));
  }

  /** Runs a long or cancellable command in its own process, streaming its output lines; its text as `query`'s. */
  execute(args: string[], options: CmRunOptions = {}): Promise<string> {
    return this.runText(args, this.placed(options), () => false);
  }

  /**
   * Runs a quick command that prints `--format` records (`recordFormat`), where `query` would, and reads each record
   * into what `readRecord` builds of its fields as it arrives (`RecordReader`): the output is never held whole, so a
   * big answer costs about what its rows weigh, and nothing stops it for its size. Fails as `query` does.
   */
  queryRecords<T>(args: string[], readRecord: ReadRecord<T>, options: CmRecordsOptions = {}): Promise<T[]> {
    const placed = this.placed(options);
    return this.runStreamed(args, new RecordReader(readRecord), placed, this.runsInPooledShell(args, placed));
  }

  /** Runs a long or cancellable command that prints `--format` records in its own process, reading them as `queryRecords` does. */
  executeRecords<T>(args: string[], readRecord: ReadRecord<T>, options: CmRecordsOptions = {}): Promise<T[]> {
    return this.runStreamed(args, new RecordReader(readRecord), this.placed(options), false);
  }

  /**
   * Runs a quick command whose list only `--xml` prints (`cm history`), where `query` would, and reads each element
   * named `element` as it arrives (`XmlElementReader`) into what `readElement` builds of it, as `queryRecords` reads
   * records.
   */
  queryXmlElements<T>(args: string[], element: string, readElement: ReadElement<T>, options: CmRecordsOptions = {}): Promise<T[]> {
    const placed = this.placed(options);
    return this.runStreamed(args, new XmlElementReader(element, readElement), placed, this.runsInPooledShell(args, placed));
  }

  /**
   * Runs a quick command whose list comes one item a line with no `--format` (`cm listusers`), where `query` would,
   * and reads each line as it arrives (`LineReader`) into what `readLine` builds of it, as `queryRecords` reads records.
   */
  queryLines<T>(args: string[], readLine: ReadLine<T>, options: CmRecordsOptions = {}): Promise<T[]> {
    const placed = this.placed(options);
    return this.runStreamed(args, new LineReader(readLine), placed, this.runsInPooledShell(args, placed));
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
   * Runs a command whose output is text, kept as its kind says (`textOutputKind`), which refuses a list before it runs.
   * `useShell` is asked only then: a refused command warms no session up.
   */
  private async runText(args: string[], options: CmRunOptions, useShell: () => boolean): Promise<string> {
    const reading: OutputReading = { text: textLimitOf(textOutputKind(args)) };
    return this.run(args, options, useShell(), reading);
  }

  /**
   * Runs the command with its stdout read by `reader` as it arrives. What it printed besides (its stderr, text after
   * the last item) is its output, which explains its failure and is no item.
   */
  private async runStreamed<T>(args: string[], reader: StreamReader & { finish(): T[] }, options: CmRecordsOptions, useShell: boolean): Promise<T[]> {
    await this.run(args, options, useShell, { stream: reader });
    return reader.finish();
  }

  /**
   * Runs `cm <args>`, logs it and fails on an exit code other than 0; its output read as `reading` says. A server command
   * to a server that needs a sign-in doesn't run, and a sign-in problem it runs into fails as one (`SignInGate`).
   */
  private async run(requested: string[], options: CmRunOptions, useShell: boolean, reading: OutputReading): Promise<string> {
    const cwd = options.cwd ?? homedir();
    const args = withUtf8Output(inCmPathForm(requested, cwd, this.platform));
    const gate = this.signInGate && !this.signInGate.passes(args) ? this.signInGate : null;
    const server = gate?.serverOf(cwd, options.server);
    const refused = server !== undefined && isServerCommand(args) ? gate?.refusal(server) : undefined;
    if (refused) throw this.notRun(args, cwd, refused);

    const startedAt = Date.now();
    const log = (result: CmResult): CommandLogEntry => this.log(args, cwd, startedAt, result, useShell);
    const signInFailure = async (kind: SignInProblemKind | null, entry: CommandLogEntry): Promise<CmSignInError | null> => {
      if (!gate || !kind) return null;
      // Its server, or else its workspace's, learned only now that it failed for a sign-in.
      return this.signInFailure(gate, server ?? (await gate.learnServerOf(cwd)), startedAt, entry);
    };
    const finished = useShell ? this.shellPool.run(cwd, args, reading) : this.runProcess(args, cwd, options, reading);
    this.startListeners.forEach((listener) => listener({ args, cwd, finished }));

    const result = await finished.catch(async (error: unknown) => {
      // A command its caller cancelled is no failure to log; one that gave up waiting (a timeout's abort) is.
      if (options.signal?.aborted && !gaveUpWaiting(options.signal)) throw error;
      const entry = log(endedWithoutExitCode(error));
      if (error instanceof CmOutputTooLargeError) throw stoppedFailure(error, entry);
      if (!(error instanceof WaitingForInputError)) throw error;
      throw (await signInFailure('signInRequired', entry)) ?? stoppedFailure(error, entry);
    });
    const entry = log(result);
    if (result.exitCode !== 0) throw (await signInFailure(signInFailureOf(result.output), entry)) ?? failure(result, entry);
    return result.output;
  }

  /** A command its server's sign-in keeps from running, logged as not run (`notRun`) so the command log explains itself. */
  private notRun(args: string[], cwd: string, problem: SignInProblem): CmSignInError {
    const output = `Not run: sign in to ${problem.server} first.`;
    const entry = this.log(args, cwd, Date.now(), { output, exitCode: -1 }, false, true);
    return new CmSignInError(problem, commandOf(entry));
  }

  /**
   * A failure that said its server needs a sign-in, once the gate confirmed it (`SignInGate.confirm`); null when its
   * server can't be known (never guessed: `learnServerOf`), or its session turned out fine.
   */
  private async signInFailure(gate: SignInGate, server: string | undefined, startedAt: number, entry: CommandLogEntry): Promise<CmSignInError | null> {
    const problem = server === undefined ? null : await gate.confirm(server, startedAt);
    return problem && new CmSignInError(problem, commandOf(entry));
  }

  /** A process of its own: `cm` as it is, or a `cm shell` of its own for an operation or a command line too long to start one with (`processCommand`). */
  private async runProcess(args: string[], cwd: string, { signal, killSignal, onOutputLine }: CmRunOptions, reading: OutputReading): Promise<CmResult> {
    const { args: started, input } = processCommand(args, this.platform);
    const { runProcess } = this.runners;
    if (input === undefined) return runProcess(this.cmPath, started, { cwd, signal, killSignal, onOutputLine, reading });
    const outputLine = onOutputLine && ((line: string) => !isShellResultLine(line) && onOutputLine(line));
    const result = await runProcess(this.cmPath, started, { cwd, signal, killSignal, onOutputLine: outputLine, input, reading });
    // A `cm shell` of its own ends its output with a result line; streamed, the line follows the last item.
    return shellCommandResult(result.output);
  }

  /**
   * Logs the command with its secrets hidden (`hideSecrets`) and clipped (`clipForLog`); returns it unclipped, for the
   * error that reports it: what reads the error in main may need all of it, and the window gets it clipped
   * (`registerApi`).
   */
  private log(args: string[], cwd: string, startedAt: number, result: CmResult, viaShell: boolean, notRun = false): CommandLogEntry {
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
      ...(cwd === this.outsideWorkspaces && { outsideWorkspaces: true as const }),
      ...(notRun && { notRun: true as const }),
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

/** The failed command an error reports: the logged entry, unclipped. */
function commandOf(entry: CommandLogEntry): FailedCommand {
  return { commandLine: entry.commandLine, exitCode: entry.exitCode, output: entry.output, logEntryId: entry.id };
}

/**
 * A command the app stopped for a reason of its own (`CmOutputTooLargeError`, or a prompt it never answers:
 * `WaitingForInputError`), reported with its details as any failure.
 */
function stoppedFailure(error: Error, entry: CommandLogEntry): CmError {
  return new CmError(error.message, commandOf(entry));
}

/** A command that exited with another code than 0, explained by the error line of its output. */
function failure(result: CmResult, entry: CommandLogEntry): CmError {
  return new CmError(outputForLog(extractErrorMessage(result.output)), commandOf(entry));
}

/** Whether a signal aborted because its time ran out (`AbortSignal.timeout`, `readOneObject`), not by its caller. */
function gaveUpWaiting(signal: AbortSignal): boolean {
  return signal.reason instanceof DOMException && signal.reason.name === 'TimeoutError';
}
