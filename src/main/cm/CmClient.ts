import { homedir } from 'node:os';
import type { CommandLogEntry } from '@shared/events';
import { CmError } from './CmError';
import { isShellResultLine, processCommand, shellCommandResult } from './commandLineLimit';
import { clipForLog, MAX_LOGGED_COMMAND_LINE, MAX_LOGGED_OUTPUT } from './clipForLog';
import type { CmResult } from './CmResult';
import { CmShellPool } from './CmShellPool';
import { extractErrorMessage } from './errorMessage';
import { runCmProcess } from './runCmProcess';
import { canRunInShell } from './shellCommandLine';

export interface CmRunOptions {
  /** Working directory; `cm` resolves the workspace and repository from it. */
  cwd?: string;
  signal?: AbortSignal;
  /** Signal sent to the process when `signal` aborts (default SIGTERM). */
  killSignal?: NodeJS.Signals;
  onOutputLine?: (line: string) => void;
}

type CommandLogListener = (entry: CommandLogEntry) => void;
type CommandStartedListener = (command: { args: readonly string[]; cwd: string; finished: Promise<unknown> }) => void;

/**
 * The single entry point to the `cm` CLI.
 * Short queries reuse pooled `cm shell` sessions; operations that stream progress
 * or can be cancelled run as dedicated processes.
 */
export class CmClient {
  private cmPath: string;
  private shellPool: CmShellPool;
  private readonly logListeners = new Set<CommandLogListener>();
  private readonly startListeners = new Set<CommandStartedListener>();
  private nextCommandId = 1;

  /** `locate` finds the `cm` executable; it runs again on `relocate()`. */
  constructor(private readonly locate: () => string) {
    this.cmPath = locate();
    this.shellPool = new CmShellPool(this.cmPath);
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
    this.shellPool = new CmShellPool(cmPath);
  }

  onCommandLogged(listener: CommandLogListener): () => void {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  onCommandStarted(listener: CommandStartedListener): () => void {
    this.startListeners.add(listener);
    return () => this.startListeners.delete(listener);
  }

  /** Runs a quick, non-interactive command. Prefer this for reads. */
  query(args: string[], options: CmRunOptions = {}): Promise<string> {
    const useShell = !options.signal && !options.onOutputLine && canRunInShell(args) && this.shellPool.isReady(options.cwd ?? homedir());
    return this.run(args, options, useShell);
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

  private async run(args: string[], options: CmRunOptions, useShell: boolean): Promise<string> {
    const cwd = options.cwd ?? homedir();
    const startedAt = Date.now();
    const finished = useShell ? this.shellPool.run(cwd, args) : this.runProcess(args, cwd, options);
    this.startListeners.forEach((listener) => listener({ args, cwd, finished }));
    const result = await finished;

    const entry = this.log(args, cwd, startedAt, result, useShell);

    if (result.exitCode !== 0) {
      throw new CmError(extractErrorMessage(result.output), {
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
    const { args: started, input } = processCommand(args);
    if (input === undefined) return runCmProcess(this.cmPath, started, { cwd, signal, killSignal, onOutputLine });
    const outputLine = onOutputLine && ((line: string) => !isShellResultLine(line) && onOutputLine(line));
    const result = await runCmProcess(this.cmPath, started, { cwd, signal, killSignal, onOutputLine: outputLine, input });
    return shellCommandResult(result.output);
  }

  /** Logs the command, clipped (`clipForLog`); returns it whole, for the error that reports it. */
  private log(args: string[], cwd: string, startedAt: number, result: CmResult, viaShell: boolean): CommandLogEntry {
    const commandLine = `cm ${args.join(' ')}`;
    const output = result.exitCode === 0 ? '' : result.output.trim();
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
