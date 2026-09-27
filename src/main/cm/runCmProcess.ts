import { spawn } from 'node:child_process';
import type { CmResult } from './CmResult';

export interface CmProcessOptions {
  cwd?: string;
  signal?: AbortSignal;
  /** Signal sent when `signal` aborts. Use SIGKILL for lookups that may hang on a credentials prompt. */
  killSignal?: NodeJS.Signals;
  onOutputLine?: (line: string) => void;
  /** Written to the command's stdin, which is then closed: what it reads, and nothing to answer a prompt with. */
  input?: string;
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
      stdio: 'pipe',
    });
    // A command that exits without reading its input closes the pipe first.
    child.stdin.on('error', () => undefined).end(options.input);
    const chunks: string[] = [];
    let pendingLine = '';

    const collect = (text: string): void => {
      chunks.push(text);
      if (!options.onOutputLine) return;

      // A progress line rewritten in place (`\r`) counts as a line of its own.
      const lines = (pendingLine + text).split(/\r\n|\r|\n/);
      pendingLine = lines.pop() ?? '';
      lines.forEach(options.onOutputLine);
    };

    // Decoded by the streams, so a character split between two chunks stays whole.
    child.stdout.setEncoding('utf8').on('data', collect);
    child.stderr.setEncoding('utf8').on('data', collect);
    child.on('error', reject);
    child.on('close', (code) => {
      if (pendingLine) options.onOutputLine?.(pendingLine);
      // Windows ends lines with CRLF; parsers get LF, as from a `cm shell`.
      resolve({ output: chunks.join('').replaceAll('\r\n', '\n'), exitCode: code ?? -1 });
    });
  });
}
