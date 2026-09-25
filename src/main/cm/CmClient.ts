import { homedir } from 'node:os';
import type { CommandLogEntry } from '@shared/events';
import { CmError } from './CmError';
import type { CmResult } from './CmResult';
import { CmShellPool } from './CmShellPool';
import { runCmProcess } from './runCmProcess';
import { canRunInShell } from './shellCommandLine';

export interface CmRunOptions {
  /** Working directory; `cm` resolves the workspace and repository from it. */
  cwd?: string;
  signal?: AbortSignal;
  onOutputLine?: (line: string) => void;
}

type CommandLogListener = (entry: CommandLogEntry) => void;

/**
 * The single entry point to the `cm` CLI.
 * Short queries reuse pooled `cm shell` sessions; operations that stream progress
 * or can be cancelled run as dedicated processes.
 */
export class CmClient {
  private readonly shellPool: CmShellPool;
  private readonly logListeners = new Set<CommandLogListener>();
  private nextCommandId = 1;

  constructor(private readonly cmPath: string) {
    this.shellPool = new CmShellPool(cmPath);
  }

  onCommandLogged(listener: CommandLogListener): () => void {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  /** Runs a quick, non-interactive command. Prefer this for reads. */
  query(args: string[], options: CmRunOptions = {}): Promise<string> {
    const useShell = !options.signal && !options.onOutputLine && canRunInShell(args);
    return this.run(args, options, useShell);
  }

  /** Runs a long or cancellable command in its own process, streaming its output. */
  execute(args: string[], options: CmRunOptions = {}): Promise<string> {
    return this.run(args, options, false);
  }

  dispose(): void {
    this.shellPool.disposeAll();
  }

  private async run(args: string[], options: CmRunOptions, useShell: boolean): Promise<string> {
    const cwd = options.cwd ?? homedir();
    const startedAt = Date.now();
    const result = useShell
      ? await this.shellPool.run(cwd, args)
      : await runCmProcess(this.cmPath, args, { cwd, signal: options.signal, onOutputLine: options.onOutputLine });

    this.log(args, cwd, startedAt, result, useShell);

    if (result.exitCode !== 0) {
      throw new CmError(extractErrorMessage(result.output), `cm ${args.join(' ')}`, result.exitCode);
    }
    return result.output;
  }

  private log(args: string[], cwd: string, startedAt: number, result: CmResult, viaShell: boolean): void {
    const entry: CommandLogEntry = {
      id: this.nextCommandId++,
      commandLine: `cm ${args.join(' ')}`,
      cwd,
      startedAt,
      durationMs: Date.now() - startedAt,
      exitCode: result.exitCode,
      viaShell,
      output: result.exitCode === 0 ? '' : result.output.trim(),
    };
    this.logListeners.forEach((listener) => listener(entry));
  }
}

function extractErrorMessage(output: string): string {
  const lines = output.trim().split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.at(-1)?.replace(/^Error:\s*/, '') ?? 'The cm command failed.';
}
