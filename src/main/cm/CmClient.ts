import { homedir } from 'node:os';
import type { CommandLogEntry } from '@shared/events';
import { CmError } from './CmError';
import { clipForLog, MAX_LOGGED_COMMAND_LINE, MAX_LOGGED_OUTPUT } from './clipForLog';
import { inCmPathForm } from './cmPathForm';
import type { CmResult } from './CmResult';
import { CmShellPool } from './CmShellPool';
import { extractErrorMessage } from './errorMessage';
import { commandLineForLog, outputForLog } from './hideSecrets';
import { runsLong } from './longCommands';
import { processCommand } from './processCommand';
import { runCmProcess } from './runCmProcess';
import { canRunInShell } from './shellCommandLine';
import { isShellResultLine, shellCommandResult } from './shellResultLine';
import { withUtf8Output } from './utf8Output';

export interface CmRunOptions {
  /** Working directory; `cm` resolves the workspace and repository from it. */
  cwd?: string;
  signal?: AbortSignal;
  /** Signal sent to the process when `signal` aborts (default SIGTERM). */
  killSignal?: NodeJS.Signals;
  onOutputLine?: (line: string) => void;
}

type CommandLogListener = (entry: CommandLogEntry) => void;
type ShellPool = Pick<CmShellPool, 'run' | 'isReady' | 'warmUp' | 'release' | 'disposeAll'>;

/** What `CmClient` runs commands with: a process of their own, and pooled `cm shell` sessions. Tests pass fakes. */
export interface CmRunners {
  runProcess: typeof runCmProcess;
  createShellPool: (cmPath: string) => ShellPool;
}

/** The exit code logged for a command that never got one of its own. */
const NO_EXIT_CODE = -1;

const CM_RUNNERS: CmRunners = { runProcess: runCmProcess, createShellPool: (cmPath) => new CmShellPool(cmPath) };
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

  /** `locate` finds the `cm` executable; it runs again on `relocate()`. */
  constructor(
    private readonly locate: () => string,
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
    return this.run(args, options, this.runsInPooledShell(args, options));
  }

  /** Runs a long or cancellable command in its own process, streaming its output. */
  execute(args: string[], options: CmRunOptions = {}): Promise<string> {
    return this.run(args, options, false);
  }

  /** Prepares `cm shell` sessions for a working directory (defaults to the home directory). */
  warmUp(cwd = homedir()): void {
    this.shellPool.warmUp(cwd);
  }

  /** Ends the `cm shell` sessions of a working directory no window shows anymore (each holds tens of MB). */
  release(cwd: string): void {
    this.shellPool.release(cwd);
  }

  dispose(): void {
    this.shellPool.disposeAll();
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

  private async run(requested: string[], options: CmRunOptions, useShell: boolean): Promise<string> {
    const cwd = options.cwd ?? homedir();
    const args = withUtf8Output(inCmPathForm(requested, cwd, this.platform));
    const startedAt = Date.now();
    const finished = useShell ? this.shellPool.run(cwd, args) : this.runProcess(args, cwd, options);
    this.startListeners.forEach((listener) => listener({ args, cwd, finished }));
    const result = await finished.catch((error: unknown) => {
      // Ended without an exit code (`cm` not found, a stalled prompt, a closed session): a failure to log like any
      // other. One its caller cancelled is none.
      if (!options.signal?.aborted) {
        this.log(args, cwd, startedAt, { output: error instanceof Error ? error.message : String(error), exitCode: NO_EXIT_CODE }, useShell);
      }
      throw error;
    });

    const entry = this.log(args, cwd, startedAt, result, useShell);

    if (result.exitCode !== 0) {
      throw new CmError(outputForLog(extractErrorMessage(result.output)), {
        commandLine: entry.commandLine,
        exitCode: entry.exitCode,
        output: entry.output,
        logEntryId: entry.id,
      });
    }
    return result.output;
  }

  /** A process of its own; a command line too long to start one with (thousands of paths) goes to a `cm shell` of its own. */
  private async runProcess(args: string[], cwd: string, { signal, killSignal, onOutputLine }: CmRunOptions): Promise<CmResult> {
    const { args: started, input } = processCommand(args, this.platform);
    const { runProcess } = this.runners;
    if (input === undefined) return runProcess(this.cmPath, started, { cwd, signal, killSignal, onOutputLine });
    const outputLine = onOutputLine && ((line: string) => !isShellResultLine(line) && onOutputLine(line));
    const result = await runProcess(this.cmPath, started, { cwd, signal, killSignal, onOutputLine: outputLine, input });
    return shellCommandResult(result.output);
  }

  /** Logs the command with its secrets hidden (`hideSecrets`) and clipped (`clipForLog`); returns it unclipped, for the error that reports it. */
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
    const logged = { ...entry, commandLine: clipForLog(commandLine, MAX_LOGGED_COMMAND_LINE), output: clipForLog(output, MAX_LOGGED_OUTPUT) };
    this.logListeners.forEach((listener) => listener(logged));
    return entry;
  }
}
