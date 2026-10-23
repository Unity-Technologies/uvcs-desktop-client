import type { StreamReader } from './outputReading';
import { isShellResultLine } from './shellResultLine';

const LF = 0x0a;

/** What a caller builds of each line (a user's name); undefined leaves it out. */
export type ReadLine<T> = (line: string) => T | undefined;

/**
 * Reads a list a command prints one item per line, with no `--format` to print it as records (`cm listusers`), as it
 * arrives in byte chunks: each line is decoded on its own once its line break arrives, and only the line still
 * arriving is kept between chunks. CRLF reads as LF, and an empty line is no item.
 *
 * `cm` writes its errors to stderr, so stdout holds the items alone, but for the `CommandResult` line a `cm shell`
 * ends it with: each line waits for the next before it's read, and the last one, when it's that result line, is left
 * as the rest (`takeRest`) for the shell to end the command with.
 */
export class LineReader<T> implements StreamReader {
  private readonly rows: T[] = [];
  /** The bytes after the last line break: the line still arriving. */
  private incomplete: Buffer[] = [];
  /** The last whole line, read once another follows it, or at the end unless it's a shell's result line. */
  private held: string | undefined;

  constructor(private readonly readLine: ReadLine<T>) {}

  /** How many items were read so far: what a caller (a test) checks to tell lines are read as they arrive. */
  get count(): number {
    return this.rows.length;
  }

  read(chunk: Buffer): void {
    let start = 0;
    for (let end = chunk.indexOf(LF); end >= 0; end = chunk.indexOf(LF, start)) {
      const line = this.incomplete.length > 0 ? Buffer.concat([...this.incomplete, chunk.subarray(start, end)]) : chunk.subarray(start, end);
      this.incomplete = [];
      this.hold(line.toString('utf8').replace(/\r$/, ''));
      start = end + 1;
    }
    if (start < chunk.length) this.incomplete.push(start === 0 ? chunk : chunk.subarray(start));
  }

  /**
   * What followed the last item: a shell's result line (with its line break), which is no item; then forgotten. The
   * line still held, and one the output ended without a line break, are items otherwise.
   */
  takeRest(): string {
    const unended = Buffer.concat(this.incomplete).toString('utf8').replace(/\r$/, '');
    this.incomplete = [];
    const last = [this.held, unended].filter((line): line is string => line !== undefined && line !== '');
    this.held = undefined;
    let rest = '';
    for (const line of last) {
      if (isShellResultLine(line)) rest += `${line}\n`;
      else this.readLineIn(line);
    }
    return rest;
  }

  /** The items read, the last line among them. */
  finish(): T[] {
    if (this.held !== undefined) this.readLineIn(this.held);
    this.held = undefined;
    return this.rows;
  }

  private hold(line: string): void {
    if (this.held !== undefined) this.readLineIn(this.held);
    this.held = line;
  }

  private readLineIn(line: string): void {
    if (line === '') return;
    const row = this.readLine(line);
    if (row !== undefined) this.rows.push(row);
  }
}
