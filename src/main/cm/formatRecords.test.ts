import { describe, expect, it } from 'vitest';
import { parseRecords, recordFormat } from './formatRecords';
import { formatOutput } from './testing/cmOutput';

describe('recordFormat', () => {
  it('ends each field and record with a control character', () => {
    expect(recordFormat(['id', 'date:o'])).toBe('{id}\u001f{date:o}\u001e');
  });
});

describe('parseRecords', () => {
  it('reads nothing from an empty output', () => {
    expect(parseRecords('')).toEqual([]);
  });

  it('keeps line breaks, Unicode and empty fields inside a record', () => {
    expect(parseRecords(formatOutput(['1', 'Multi\nline', '', 'ça 日本']))).toEqual([['1', 'Multi\nline', '', 'ça 日本']]);
  });

  // `cm find`, `cm ls` and `cm annotate` print values as they are: a comment or a line of code between quotes is one.
  it('keeps the quotes a value starts and ends with', () => {
    expect(parseRecords(formatOutput(['"WIP"', '"']))).toEqual([['"WIP"', '"']]);
  });

  it('reads records whose lines end with CRLF', () => {
    expect(parseRecords('1\u001fa\u001e\r\n2\u001fb\u001e\r\n')).toEqual([
      ['1', 'a'],
      ['2', 'b'],
    ]);
  });
});
