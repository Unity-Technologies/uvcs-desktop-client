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
 * The records of a `--format` output, each value exactly as `cm` printed it (`cm` ends each record with a line break
 * after the record separator). Only `cm diff` quotes some of its values: `unquoted`.
 */
export function parseRecords(output: string): string[][] {
  return output
    .split(RECORD_SEPARATOR)
    .map((record) => record.replace(/^\r?\n/, ''))
    .filter((record) => record.length > 0)
    .map((record) => record.split(FIELD_SEPARATOR));
}

/** A value `cm` printed between double quotes (`cm diff`'s paths and repository), without them. */
export function unquoted(value: string): string {
  return value.length >= 2 && value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
}
