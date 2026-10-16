/** Control characters, which never appear in names, paths or comments: records split without ambiguity. */
export const FIELD_SEPARATOR = '\u001f';
export const RECORD_SEPARATOR = '\u001e';

/**
 * Builds a `--format` value whose output `parseRecords` can split unambiguously. A placeholder may carry a .NET format
 * (`date:o`), which `cm ls` applies to its dates.
 */
export function recordFormat(placeholders: readonly string[]): string {
  return placeholders.map((name) => `{${name}}`).join(FIELD_SEPARATOR) + RECORD_SEPARATOR;
}

/**
 * The records of a `--format` output, each value as `cm` printed it, CRLF turned into LF (a comment written on
 * Windows keeps its CRLF in the repository). `cm` ends each record with a line break after the record separator. Only
 * `cm diff` quotes some of its values: `unquoted`.
 */
export function parseRecords(output: string): string[][] {
  return output
    .split(RECORD_SEPARATOR)
    .map((record) => record.replace(/^\r?\n/, ''))
    .filter((record) => record.length > 0)
    .map((record) => withLf(record).split(FIELD_SEPARATOR));
}

function withLf(text: string): string {
  return text.includes('\r') ? text.replaceAll('\r\n', '\n') : text;
}

/** What one record's values become; `undefined` leaves the record out. */
export type ReadRecord<T> = (fields: string[]) => T | undefined;

/** The fields a `--format` prints of each item, and what a record of them becomes (`undefined`: none). */
export interface RecordLayout<T, Field extends string = string> {
  fields: readonly Field[];
  /** Gets each record's values by field name. */
  read: (value: (field: Field) => string) => T | undefined;
}

/** The `--format` that prints the layout's fields as `readRecords` reads them. */
export function layoutFormat(layout: RecordLayout<unknown>): string {
  return `--format=${recordFormat(layout.fields)}`;
}

/** Reads a record printed through `layoutFormat`, by field name: the field indexes are found once, not per record. */
export function layoutReader<T, Field extends string>({ fields, read }: RecordLayout<T, Field>): ReadRecord<T> {
  const indexes = new Map(fields.map((field, index) => [field, index]));
  return (values) => read((field) => values[indexes.get(field)!] ?? '');
}

/** The items of an output printed through `layoutFormat`. */
export function readRecords<T, Field extends string>(layout: RecordLayout<T, Field>, output: string): T[] {
  const read = layoutReader(layout);
  return parseRecords(output).flatMap((values) => {
    const item = read(values);
    return item === undefined ? [] : [item];
  });
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
