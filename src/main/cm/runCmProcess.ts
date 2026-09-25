import { spawn } from 'node:child_process';
import type { CmResult } from './CmResult';

export interface CmProcessOptions {
  cwd?: string;
  signal?: AbortSignal;
  /** Signal sent when `signal` aborts. Use SIGKILL for lookups that may hang on a credentials prompt. */
  killSignal?: NodeJS.Signals;
  onOutputLine?: (line: string) => void;
}

/**
 * Runs one `cm` command in its own process. Its stdin is closed, so a command that stops to ask
 * something on the console (credentials, "are you sure?") fails at once instead of hanging.
 */
export function runCmProcess(cmPath: string, args: string[], options: CmProcessOptions): Promise<CmResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmPath, args, {
      cwd: options.cwd,
      signal: options.signal,
      killSignal: options.killSignal,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const chunks: string[] = [];
    let pendingLine = '';

    const collect = (data: Buffer): void => {
      const text = data.toString('utf8');
      chunks.push(text);
      if (!options.onOutputLine) return;

      // A progress line rewritten in place (`\r`) counts as a line of its own.
      const lines = (pendingLine + text).split(/\r\n|\r|\n/);
      pendingLine = lines.pop() ?? '';
      lines.forEach(options.onOutputLine);
    };

    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('error', reject);
    child.on('close', (code) => {
      if (pendingLine) options.onOutputLine?.(pendingLine);
      resolve({ output: chunks.join(''), exitCode: code ?? -1 });
    });
  });
}
