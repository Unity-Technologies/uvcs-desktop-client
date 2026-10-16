/** Control characters, which never appear in names, paths or comments: records split without ambiguity. */
export const FIELD_SEPARATOR = '\u001f';
export const RECORD_SEPARATOR = '\u001e';

const RECORD_SEPARATOR_BYTE = 0x1e;
const CR_BYTE = 0x0d;
const LF_BYTE = 0x0a;

/** Builds a `--format` value whose output `parseRecords` and `RecordReader` split unambiguously. */
export function recordFormat(placeholders: string[]): string {
  return placeholders.map((name) => `{${name}}`).join(FIELD_SEPARATOR) + RECORD_SEPARATOR;
}

/** What a caller builds of each record's fields (a branch, a changeset); undefined leaves the record out. */
export type ReadRecord<T> = (fields: string[]) => T | undefined;

const asFields: ReadRecord<string[]> = (fields) => fields;

/** The records of a whole `--format` output, read by `readRecord` (their fields, by default). */
export function parseRecords(output: string): string[][];
export function parseRecords<T>(output: string, readRecord: ReadRecord<T>): T[];
export function parseRecords<T>(output: string, readRecord?: ReadRecord<T>): (T | string[])[] {
  const reader = new RecordReader<T | string[]>(readRecord ?? asFields);
  reader.read(Buffer.from(output, 'utf8'));
  return reader.finish(reader.takeRest());
}

/**
 * Reads `--format` records (`recordFormat`) from a command's output as it arrives, in byte chunks, into what
 * `readRecord` builds of them: only the record still arriving is kept between chunks, so the output is never held
 * whole, nor split into an array of records first. A big answer (every branch and changeset of a large repository)
 * costs the main process about what its rows weigh.
 *
 * Bytes, not text: the record separator is ASCII, which UTF-8 never uses inside a character of several bytes, so a
 * record is found before decoding, and a character split between two chunks is decoded whole. Each record is decoded
 * on its own and its fields are slices of it: a value keeps alive its own record at most, never the chunk or the
 * output it came in (slices of decoded chunks would keep every chunk alive while any value lives). One decoding per
 * record, not per field: each decoding is a call into C++, which is what a record's fields cost most.
 *
 * As `cm` prints them: a line break after each record's separator (CRLF on Windows, read as LF in fields too), and a
 * value between quotes loses them.
 */
export class RecordReader<T> {
  private readonly rows: T[] = [];
  /** The bytes after the last record separator: the record still arriving, or text that is no record at all. */
  private incomplete: Buffer[] = [];

  constructor(private readonly readRecord: ReadRecord<T>) {}

  /** How many records were read so far. */
  get count(): number {
    return this.rows.length;
  }

  /** Reads the records the chunk completes; what follows the last of them waits for the next chunk. */
  read(chunk: Buffer): void {
    let start = 0;
    let end = chunk.indexOf(RECORD_SEPARATOR_BYTE);
    if (end >= 0 && this.incomplete.length > 0) {
      const record = Buffer.concat([...this.incomplete, chunk.subarray(0, end)]);
      this.incomplete = [];
      this.readRecordIn(record, 0, record.length);
      start = end + 1;
      end = chunk.indexOf(RECORD_SEPARATOR_BYTE, start);
    }
    for (; end >= 0; end = chunk.indexOf(RECORD_SEPARATOR_BYTE, start)) {
      this.readRecordIn(chunk, start, end);
      start = end + 1;
    }
    if (start < chunk.length) this.incomplete.push(start === 0 ? chunk : chunk.subarray(start));
  }

  /**
   * The text after the last record, which it then forgets: nothing for an output of records alone, what a command
   * prints besides them (an error, a `cm shell`'s `CommandResult` line) otherwise. Without the line break that ends
   * the last record, Windows' CRLF read as LF.
   */
  takeRest(): string {
    const bytes = Buffer.concat(this.incomplete);
    this.incomplete = [];
    return withLf(bytes.toString('utf8', lineBreakLength(bytes, 0, bytes.length)));
  }

  /** The rows read, `trailing` read as one more record when there is any: a last record printed without its separator. */
  finish(trailing: string): T[] {
    if (trailing) this.read(Buffer.from(`${trailing}${RECORD_SEPARATOR}`, 'utf8'));
    return this.rows;
  }

  /** Reads the record between `start` and its separator at `end`; an empty one is no record. */
  private readRecordIn(bytes: Buffer, start: number, end: number): void {
    const fieldsStart = start + lineBreakLength(bytes, start, end);
    if (fieldsStart === end) return;
    const record = bytes.toString('utf8', fieldsStart, end);
    const fields = (record.includes('\r') ? withLf(record) : record).split(FIELD_SEPARATOR);
    for (let index = 0; index < fields.length; index++) fields[index] = unquote(fields[index]!);
    const row = this.readRecord(fields);
    if (row !== undefined) this.rows.push(row);
  }
}

/** The length of the line break at `start` (LF or CRLF), which `cm` prints after each record's separator. */
function lineBreakLength(bytes: Buffer, start: number, end: number): number {
  if (start < end && bytes[start] === LF_BYTE) return 1;
  if (start + 1 < end && bytes[start] === CR_BYTE && bytes[start + 1] === LF_BYTE) return 2;
  return 0;
}

/** Windows ends lines with CRLF; parsers get LF, as everywhere else. */
function withLf(text: string): string {
  return text.replaceAll('\r\n', '\n');
}

const QUOTE_CODE = 0x22;

function unquote(value: string): string {
  const quoted = value.length >= 2 && value.charCodeAt(0) === QUOTE_CODE && value.charCodeAt(value.length - 1) === QUOTE_CODE;
  return quoted ? value.slice(1, -1) : value;
}
