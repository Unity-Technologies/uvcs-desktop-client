import { describe, expect, it } from 'vitest';
import { FIELD_SEPARATOR, parseRecords, recordFormat, RECORD_SEPARATOR } from './formatRecords';
import { formatOutput } from './testing/cmOutput';

describe('recordFormat', () => {
  it('ends each field with the field separator and the record with the record separator', () => {
    expect(recordFormat(['id', 'name'])).toBe(`{id}${FIELD_SEPARATOR}{name}${RECORD_SEPARATOR}`);
  });
});

describe('parseRecords', () => {
  it('reads each record as its fields', () => {
    expect(parseRecords(formatOutput([1, '/main', 'jane'], [2, '/main/task', 'joe']))).toEqual([
      ['1', '/main', 'jane'],
      ['2', '/main/task', 'joe'],
    ]);
  });

  it('reads nothing from an empty output', () => {
    expect(parseRecords('')).toEqual([]);
    expect(parseRecords('\n')).toEqual([]);
  });

  it('keeps empty fields, line breaks in a field and characters of any script', () => {
    const output = formatOutput(['', 'Multi\nline', 'Ñandú 日本語 🎮', '']);
    expect(parseRecords(output)).toEqual([['', 'Multi\nline', 'Ñandú 日本語 🎮', '']]);
  });

  it('takes the quotes cm puts around a value away', () => {
    expect(parseRecords(formatOutput(['"quoted"', '"', 'in "the" middle']))).toEqual([['quoted', '"', 'in "the" middle']]);
  });

  it('reads text after the last record as one more record', () => {
    expect(parseRecords(`${formatOutput(['1', 'a'])}2${FIELD_SEPARATOR}b`)).toEqual([
      ['1', 'a'],
      ['2', 'b'],
    ]);
  });
});
