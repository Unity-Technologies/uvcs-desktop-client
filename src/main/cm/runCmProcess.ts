import { spawn } from 'node:child_process';
import type { CmResult } from './CmResult';
import { OutputBuffer } from './OutputBuffer';
import { ANSWER_TEXT, CmOutputTooLargeError, MAX_TEXT_OUTPUT_LENGTH } from './outputLimit';
import type { OutputReading, StreamReader } from './outputReading';

export interface CmProcessOptions {
  cwd?: string;
  signal?: AbortSignal;
  /** Signal sent when `signal` aborts. Use SIGKILL for lookups that may hang on a credentials prompt. */
  killSignal?: NodeJS.Signals;
  onOutputLine?: (line: string) => void;
  /** Written to the command's stdin, which is then closed: what it reads, and nothing to answer a prompt with. */
  input?: string;
  /**
   * How its output is read (an answer's text by default): kept as text within its limit, an answer past it killed and
   * failed; or its stdout streamed into a reader as it arrives (`CmClient.queryRecords`), never stopped for its size,
   * the result's output then what it wrote to stderr and what followed its last item (`takeRest`), with no lines to
   * report.
   */
  reading?: OutputReading;
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
    const { reading = { text: ANSWER_TEXT } } = options;
    const stream = 'stream' in reading ? reading.stream : undefined;
    // A stream's stderr is its errors, a few lines: kept as an operation's text would be, by its ends past the limit.
    const text = 'text' in reading ? reading.text : { maxLength: MAX_TEXT_OUTPUT_LENGTH, past: 'keepEnds' as const };
    const kept = new OutputBuffer(0, text.past === 'keepEnds' ? text.maxLength : undefined);
    let stopped = false;
    let pendingLine = '';

    const stop = (error: Error): void => {
      stopped = true;
      kept.clear();
      child.kill('SIGKILL');
      reject(error);
    };

    const collect = (chunk: string): void => {
      if (stopped) return;
      kept.append(chunk);
      if (text.past === 'stop' && kept.length > text.maxLength) return stop(new CmOutputTooLargeError(text.maxLength));
      if (!options.onOutputLine) return;

      // A progress line rewritten in place (`\r`) counts as a line of its own.
      const lines = (pendingLine + chunk).split(/\r\n|\r|\n/);
      pendingLine = lines.pop() ?? '';
      lines.forEach(options.onOutputLine);
    };
    const readStream = (reader: StreamReader) => (chunk: Buffer): void => {
      if (stopped) return;
      try {
        reader.read(chunk);
      } catch (error) {
        // A stream listener: nothing would catch the throw, and the command would never end.
        stop(error instanceof Error ? error : new Error(String(error)));
      }
    };

    if (stream) {
      // Bytes: the reader finds its items before decoding, so a character split between two chunks stays whole. Only
      // stdout's: what `cm` writes to stderr (its errors) is text of its own, which a write in the middle of a record
      // would otherwise land in.
      child.stdout.on('data', readStream(stream));
      child.stderr.setEncoding('utf8').on('data', collect);
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
      const printed = kept.textBefore(kept.length).replaceAll('\r\n', '\n');
      const output = stream ? printed + stream.takeRest() : printed;
      resolve({ output, exitCode: code ?? -1 });
    });
  });
}
