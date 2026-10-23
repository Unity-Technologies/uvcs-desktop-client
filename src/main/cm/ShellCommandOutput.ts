import { StringDecoder } from 'node:string_decoder';
import { OutputBuffer } from './OutputBuffer';
import { MAX_TEXT_OUTPUT_LENGTH, type TextLimit } from './outputLimit';
import type { StreamReader } from './outputReading';
import { resultLineAtEnd } from './shellResultLine';

export type OutputStream = 'stdout' | 'stderr';

/**
 * The output of the command a `cm shell` runs, as it arrives, until the `CommandResult` line that ends it: kept as
 * text within its limit (`TextOutput`), or streamed into a reader as it arrives (`StreamOutput`). Either keeps its end
 * at hand, where the session looks for the result line and for prompts.
 */
export interface ShellCommandOutput {
  /** How much arrived: characters of text, bytes of a stream. */
  readonly length: number;
  /** Past this `length` the command is stopped (an answer past its `TextLimit`); infinite for what is never stopped. */
  readonly stopsAt: number;
  /** The last characters that arrived. */
  readonly tail: string;
  append(chunk: Buffer, stream: OutputStream): void;
  /** What the command printed before the result line its output ends with (`resultLineAtEnd`), with LF line breaks. */
  beforeResultLine(): string;
}

/** A command's output kept as text: whole, or its ends past the limit (`TextLimit`). */
export class TextOutput implements ShellCommandOutput {
  readonly stopsAt: number;
  private readonly buffer: OutputBuffer;
  // One per stream, so a character split between two chunks stays whole.
  private readonly decoders: Record<OutputStream, StringDecoder> = { stdout: new StringDecoder('utf8'), stderr: new StringDecoder('utf8') };

  constructor(tailLength: number, { maxLength, past }: TextLimit) {
    this.stopsAt = past === 'stop' ? maxLength : Number.POSITIVE_INFINITY;
    this.buffer = new OutputBuffer(tailLength, past === 'keepEnds' ? maxLength : undefined);
  }

  get length(): number {
    return this.buffer.length;
  }

  get tail(): string {
    return this.buffer.tail;
  }

  append(chunk: Buffer, stream: OutputStream): void {
    this.buffer.append(this.decoders[stream].write(chunk));
  }

  beforeResultLine(): string {
    const { tail, length } = this.buffer;
    const result = resultLineAtEnd(tail);
    const end = result ? length - tail.length + result.outputEnd : length;
    // Not a regular expression: V8 keeps the last string one ran on, which would hold the whole output in memory.
    // Windows ends lines with CRLF: the last one's CR stays before the result line's LF.
    const text = this.buffer.textBefore(end).replaceAll('\r\n', '\n');
    return text.endsWith('\r') ? text.slice(0, -1) : text;
  }
}

/**
 * A command's stdout streamed into a reader as it arrives (`StreamReader`: records, XML elements): the output is never
 * held whole, and never stopped for its size. What `cm` writes to stderr (its errors) is text kept apart: a write
 * landing in the middle of a record would otherwise end up in its fields, or split one of its characters. The result
 * line and prompts are looked for in stdout, where `cm shell` writes them.
 */
export class StreamOutput implements ShellCommandOutput {
  readonly stopsAt = Number.POSITIVE_INFINITY;
  private size = 0;
  private tailBytes = Buffer.alloc(0);
  private decodedTail = '';
  private readonly errors = new OutputBuffer(0, MAX_TEXT_OUTPUT_LENGTH);
  private readonly errorDecoder = new StringDecoder('utf8');

  constructor(
    private readonly reader: StreamReader,
    private readonly tailLength: number,
  ) {}

  get length(): number {
    return this.size;
  }

  get tail(): string {
    return this.decodedTail;
  }

  append(chunk: Buffer, stream: OutputStream): void {
    this.size += chunk.length;
    if (stream === 'stderr') {
      this.errors.append(this.errorDecoder.write(chunk));
      return;
    }
    this.reader.read(chunk);
    // A copy, not a slice: the tail keeps no chunk alive. A character cut at its start decodes as U+FFFD, which no
    // result line or prompt starts with.
    this.tailBytes = Buffer.concat([this.tailBytes, chunk.subarray(-this.tailLength)]).subarray(-this.tailLength);
    this.decodedTail = this.tailBytes.toString('utf8');
  }

  /** What the command wrote to stderr, then what followed its last item on stdout, before the result line. */
  beforeResultLine(): string {
    const rest = this.reader.takeRest();
    const result = resultLineAtEnd(rest);
    return this.errors.textBefore(this.errors.length).replaceAll('\r\n', '\n') + (result ? rest.slice(0, result.outputEnd) : rest);
  }
}
