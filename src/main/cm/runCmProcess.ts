import { spawn } from 'node:child_process';
import type { CmResult } from './CmResult';
import type { RecordReader } from './formatRecords';
import { CmOutputTooLargeError, MAX_OUTPUT_LENGTH } from './outputLimit';

export interface CmProcessOptions {
  cwd?: string;
  signal?: AbortSignal;
  /** Signal sent when `signal` aborts. Use SIGKILL for lookups that may hang on a credentials prompt. */
  killSignal?: NodeJS.Signals;
  onOutputLine?: (line: string) => void;
  /** Written to the command's stdin, which is then closed: what it reads, and nothing to answer a prompt with. */
  input?: string;
  /** The most characters (bytes, with `records`) the command may print (`MAX_OUTPUT_LENGTH`): past it, it is killed and fails. */
  maxOutputLength?: number;
  /**
   * Where the `--format` records the command prints go, read as they arrive (`CmClient.queryRecords`); the result's
   * output is then only what follows the last record (`takeRest`). Its output has no lines to report.
   */
  records?: RecordReader<unknown>;
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
    const { maxOutputLength = MAX_OUTPUT_LENGTH, records } = options;
    const chunks: string[] = [];
    let length = 0;
    let stopped = false;
    let pendingLine = '';

    const stop = (error: Error): void => {
      stopped = true;
      chunks.length = 0;
      child.kill('SIGKILL');
      reject(error);
    };
    /** Whether the command may print `size` more: past the limit it is stopped. */
    const admits = (size: number): boolean => {
      if (stopped) return false;
      length += size;
      if (length <= maxOutputLength) return true;
      stop(new CmOutputTooLargeError(maxOutputLength));
      return false;
    };

    const collect = (text: string): void => {
      if (!admits(text.length)) return;
      chunks.push(text);
      if (!options.onOutputLine) return;

      // A progress line rewritten in place (`\r`) counts as a line of its own.
      const lines = (pendingLine + text).split(/\r\n|\r|\n/);
      pendingLine = lines.pop() ?? '';
      lines.forEach(options.onOutputLine);
    };
    const collectRecords = (reader: RecordReader<unknown>) => (chunk: Buffer): void => {
      if (!admits(chunk.length)) return;
      try {
        reader.read(chunk);
      } catch (error) {
        // A stream listener: nothing would catch the throw, and the command would never end.
        stop(error instanceof Error ? error : new Error(String(error)));
      }
    };

    if (records) {
      // Bytes: the reader finds records before decoding, so a character split between two chunks stays whole.
      child.stdout.on('data', collectRecords(records));
      child.stderr.on('data', collectRecords(records));
    } else {
      // Decoded by the streams, so a character split between two chunks stays whole.
      child.stdout.setEncoding('utf8').on('data', collect);
      child.stderr.setEncoding('utf8').on('data', collect);
    }
    child.on('error', reject);
    child.on('close', (code) => {
      if (stopped) return;
      if (pendingLine) options.onOutputLine?.(pendingLine);
      // Windows ends lines with CRLF; parsers get LF, as from a `cm shell`.
      const output = records ? records.takeRest() : chunks.join('').replaceAll('\r\n', '\n');
      resolve({ output, exitCode: code ?? -1 });
    });
  });
}
