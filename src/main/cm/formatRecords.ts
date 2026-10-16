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

/** The fields a `--format` prints of each item, and what a record of them becomes. */
export interface RecordLayout<T, Field extends string = string> {
  fields: readonly Field[];
  /** Gets each record's values by field name. */
  read: (value: (field: Field) => string) => T;
}

/** The `--format` that prints the layout's fields as `readRecords` reads them. */
export function layoutFormat(layout: RecordLayout<unknown>): string {
  return `--format=${recordFormat(layout.fields)}`;
}

/** The items of an output printed through `layoutFormat`. */
export function readRecords<T, Field extends string>({ fields, read }: RecordLayout<T, Field>, output: string): T[] {
  const indexes = new Map(fields.map((field, index) => [field, index]));
  return parseRecords(output).map((values) => read((field) => values[indexes.get(field)!] ?? ''));
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
