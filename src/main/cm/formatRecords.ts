/** Control characters, which never appear in names, paths or comments: records split without ambiguity. */
export const FIELD_SEPARATOR = '\u001f';
export const RECORD_SEPARATOR = '\u001e';

const FIELD_SEPARATOR_BYTE = 0x1f;
const RECORD_SEPARATOR_BYTE = 0x1e;
const QUOTE_BYTE = 0x22;
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
 * Bytes, not text: the separators are ASCII, which UTF-8 never uses inside a character of several bytes, so a record
 * is found before decoding, and a character split between two chunks is decoded whole. Each field is decoded on its
 * own into a string of its own, so no value keeps the chunk it came from alive (a slice of decoded text would).
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
      this.readRecordIn(new RecordBytes(record), 0, record.length);
      start = end + 1;
      end = chunk.indexOf(RECORD_SEPARATOR_BYTE, start);
    }
    const bytes = new RecordBytes(chunk);
    for (; end >= 0; end = chunk.indexOf(RECORD_SEPARATOR_BYTE, start)) {
      this.readRecordIn(bytes, start, end);
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

  private readRecordIn(bytes: RecordBytes, start: number, end: number): void {
    const fields = bytes.fieldsOf(start, end);
    if (!fields) return;
    const row = this.readRecord(fields);
    if (row !== undefined) this.rows.push(row);
  }
}

/**
 * One buffer's records, read field by field. The next field separator and carriage return are looked for once in the
 * whole buffer and remembered, not once per record: a record of one field holds no separator, and looking for one in
 * each record would read the rest of the buffer every time.
 */
class RecordBytes {
  private fieldSeparator = NOT_LOOKED_FOR;
  private carriageReturn = NOT_LOOKED_FOR;

  constructor(private readonly bytes: Buffer) {}

  /** The fields of the record between `start` and its separator at `end`; null for an empty one. */
  fieldsOf(start: number, end: number): string[] | null {
    const fieldsStart = start + lineBreakLength(this.bytes, start, end);
    if (fieldsStart === end) return null;
    const fields: string[] = [];
    let fieldStart = fieldsStart;
    for (;;) {
      const separator = this.next('fieldSeparator', FIELD_SEPARATOR_BYTE, fieldStart);
      const fieldEnd = separator >= 0 && separator < end ? separator : end;
      fields.push(this.field(fieldStart, fieldEnd));
      if (fieldEnd === end) break;
      fieldStart = fieldEnd + 1;
    }
    return fields;
  }

  private field(start: number, end: number): string {
    const quoted = end - start >= 2 && this.bytes[start] === QUOTE_BYTE && this.bytes[end - 1] === QUOTE_BYTE;
    const valueStart = quoted ? start + 1 : start;
    const valueEnd = quoted ? end - 1 : end;
    const value = this.bytes.toString('utf8', valueStart, valueEnd);
    const carriageReturn = this.next('carriageReturn', CR_BYTE, valueStart);
    return carriageReturn >= 0 && carriageReturn < valueEnd ? withLf(value) : value;
  }

  /** Where the next `byte` is from `from` on, or -1: found once, and remembered until a later position asks. */
  private next(which: 'fieldSeparator' | 'carriageReturn', byte: number, from: number): number {
    const known = this[which];
    if (known === NONE_LEFT || known >= from) return known;
    const found = this.bytes.indexOf(byte, from);
    this[which] = found;
    return found;
  }
}

const NOT_LOOKED_FOR = -2;
const NONE_LEFT = -1;

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
