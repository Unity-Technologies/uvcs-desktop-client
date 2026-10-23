import type { StreamReader } from './outputReading';

/** Control characters, which never appear in names, paths or comments: records split without ambiguity. */
export const FIELD_SEPARATOR = '\u001f';
export const RECORD_SEPARATOR = '\u001e';

const RECORD_SEPARATOR_BYTE = 0x1e;
const CR_CODE = 0x0d;
const LF_CODE = 0x0a;

/**
 * Builds a `--format` value whose output `RecordReader` splits unambiguously. A placeholder may carry
 * a .NET format (`date:o`), which `cm ls` applies to its dates.
 */
export function recordFormat(placeholders: readonly string[]): string {
  return placeholders.map((name) => `{${name}}`).join(FIELD_SEPARATOR) + RECORD_SEPARATOR;
}

/** What a caller builds of each record's fields (a branch, a changeset); undefined leaves the record out. */
export type ReadRecord<T> = (fields: string[]) => T | undefined;

/** Each record as its fields: for a reader that folds the rows once they're all read (`annotationOf`). */
export const readFields: ReadRecord<string[]> = (fields) => fields;

/**
 * The fields of one record's text, without the line break `cm` prints before it (after the previous record's
 * separator): each value as `cm` printed it, CRLF turned into LF (a comment written on Windows keeps its CRLF in the
 * repository). Only `cm diff` quotes some of its values: `unquoted`.
 */
function fieldsOf(record: string): string[] {
  return withLf(record).split(FIELD_SEPARATOR);
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
 * As `cm` prints them: a line break after each record's separator (CRLF on Windows, read as LF in fields too).
 */
export class RecordReader<T> implements StreamReader {
  private readonly rows: T[] = [];
  /** The bytes after the last record separator: the record still arriving, or text that is no record at all. */
  private incomplete: Buffer[] = [];

  constructor(private readonly readRecord: ReadRecord<T>) {}

  /** How many records were read so far: what a caller (a test) checks to tell records are read as they arrive. */
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

  /**
   * The rows read. Text after the last record is no record (`takeRest`): every `recordFormat` record ends with its
   * separator, so what follows is what `cm` printed besides them, a warning or an error.
   */
  finish(): T[] {
    return this.rows;
  }

  /** Reads the record between `start` and its separator at `end`; an empty one is no record. */
  private readRecordIn(bytes: Buffer, start: number, end: number): void {
    const fieldsStart = start + lineBreakLength(bytes, start, end);
    if (fieldsStart === end) return;
    const row = this.readRecord(fieldsOf(bytes.toString('utf8', fieldsStart, end)));
    if (row !== undefined) this.rows.push(row);
  }
}

/** The length of the line break at `start` (LF or CRLF), which `cm` prints after each record's separator. */
function lineBreakLength(bytes: Buffer, start: number, end: number): number {
  if (start < end && bytes[start] === LF_CODE) return 1;
  if (start + 1 < end && bytes[start] === CR_CODE && bytes[start + 1] === LF_CODE) return 2;
  return 0;
}

/** Windows ends lines with CRLF; parsers get LF, as everywhere else. */
function withLf(text: string): string {
  return text.includes('\r') ? text.replaceAll('\r\n', '\n') : text;
}

/** The fields a `--format` prints of each item, and what a record of them becomes (`undefined`: none). */
export interface RecordLayout<T, Field extends string = string> {
  fields: readonly Field[];
  /** Gets each record's values by field name. */
  read: (value: (field: Field) => string) => T | undefined;
}

/** The `--format` that prints the layout's fields as `layoutReader` reads them. */
export function layoutFormat(layout: RecordLayout<unknown>): string {
  return `--format=${recordFormat(layout.fields)}`;
}

/** Reads a record printed through `layoutFormat`, by field name: the field indexes are found once, not per record. */
export function layoutReader<T, Field extends string>({ fields, read }: RecordLayout<T, Field>): ReadRecord<T> {
  const indexes = new Map(fields.map((field, index) => [field, index]));
  return (values) => read((field) => values[indexes.get(field)!] ?? '');
}

/** A number `cm` printed; -1 where it printed none. */
export function integerValue(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? -1 : parsed;
}

/** A value `cm` printed between double quotes (`cm diff`'s paths and repository), without them. */
export function unquoted(value: string): string {
  return value.length >= 2 && value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
}
