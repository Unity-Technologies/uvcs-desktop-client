/** Control characters, which never appear in names, paths or comments: records split without ambiguity. */
export const FIELD_SEPARATOR = '\u001f';
export const RECORD_SEPARATOR = '\u001e';

/** Builds a `--format` value whose output `parseRecords` can split unambiguously. */
export function recordFormat(placeholders: string[]): string {
  return placeholders.map((name) => `{${name}}`).join(FIELD_SEPARATOR) + RECORD_SEPARATOR;
}

export function parseRecords(output: string): string[][] {
  return output
    .split(RECORD_SEPARATOR)
    .map((record) => record.replace(/^\r?\n/, ''))
    .filter((record) => record.length > 0)
    .map((record) => record.split(FIELD_SEPARATOR).map(unquote));
}

function unquote(value: string): string {
  return value.length >= 2 && value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
}
