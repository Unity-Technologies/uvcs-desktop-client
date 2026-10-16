import { describe, expect, it } from 'vitest';
import { FIELD_SEPARATOR, parseRecords, RecordReader, recordFormat, RECORD_SEPARATOR } from './formatRecords';
import { formatOutput } from './testing/cmOutput';
import { countBytesRead } from './testing/countBytesRead';

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

  it("reads Windows line breaks as the app's, in a field and after each record", () => {
    const output = `1${FIELD_SEPARATOR}first\r\nsecond${RECORD_SEPARATOR}\r\n2${FIELD_SEPARATOR}x\r${RECORD_SEPARATOR}\r\n`;
    expect(parseRecords(output)).toEqual([
      ['1', 'first\nsecond'],
      ['2', 'x\r'],
    ]);
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

  it('builds what its caller reads of each record, leaving out the records it skips', () => {
    const output = formatOutput(['1', 'a'], ['2', ''], ['3', 'c']);
    expect(parseRecords(output, ([id = '', name = '']) => (name ? { id: Number(id), name } : undefined))).toEqual([
      { id: 1, name: 'a' },
      { id: 3, name: 'c' },
    ]);
  });
});

describe('RecordReader', () => {
  /** The records `cm` prints as one string, read in chunks cut at `cuts` (byte offsets). */
  function readInChunks(output: string, cuts: number[]): { rows: string[][]; rest: string } {
    const bytes = Buffer.from(output, 'utf8');
    const reader = new RecordReader<string[]>((fields) => fields);
    [0, ...cuts].forEach((start, index) => reader.read(bytes.subarray(start, cuts[index] ?? bytes.length)));
    const rest = reader.takeRest();
    return { rows: reader.finish(''), rest };
  }

  const everyByte = (output: string): number[] => Array.from({ length: Buffer.byteLength(output) - 1 }, (_, index) => index + 1);

  // Every awkward place a chunk can end: inside a field, around a field or record separator, between CR and LF, inside
  // a character of several bytes, inside quotes.
  const RECORDS = [
    ['31266319', '/main/task-ñ', '"quoted"', 'Línea\r\nsegunda 日本 🎮', ''],
    ['2', '', '', 'x', '"'],
  ];
  const AS_READ = [
    ['31266319', '/main/task-ñ', 'quoted', 'Línea\nsegunda 日本 🎮', ''],
    ['2', '', '', 'x', '"'],
  ];
  const LF_OUTPUT = RECORDS.map((fields) => `${fields.join(FIELD_SEPARATOR)}${RECORD_SEPARATOR}\n`).join('');
  const CRLF_OUTPUT = RECORDS.map((fields) => `${fields.join(FIELD_SEPARATOR)}${RECORD_SEPARATOR}\r\n`).join('');

  it.each([
    ['LF', LF_OUTPUT],
    ['CRLF', CRLF_OUTPUT],
  ])('reads the same records wherever the chunks of a %s output end', (_, output) => {
    for (const cut of everyByte(output)) expect(readInChunks(output, [cut]), `cut at byte ${cut}`).toEqual({ rows: AS_READ, rest: '' });
    expect(readInChunks(output, everyByte(output))).toEqual({ rows: AS_READ, rest: '' });
  });

  it('reads records as their chunks arrive, before the output ends', () => {
    const reader = new RecordReader((fields) => fields);
    reader.read(Buffer.from(`${formatOutput(['1', 'a'], ['2', 'b'])}3${FIELD_SEPARATOR}`));
    expect(reader.count).toBe(2);
    reader.read(Buffer.from(`c${RECORD_SEPARATOR}\n`));
    expect(reader.count).toBe(3);
  });

  it('leaves what a cm shell prints after the records, its result line split between chunks, as the rest', () => {
    const output = `${CRLF_OUTPUT}CommandResult 0\r\n`;
    const resultLine = Buffer.from(output).indexOf('Result');
    expect(readInChunks(output, [resultLine, resultLine + 3])).toEqual({ rows: AS_READ, rest: 'CommandResult 0\n' });
  });

  it('reads no record from an error, which it leaves whole as the rest', () => {
    const error = "Error: The branch 'br:/main/gone' does not exist.\r\nCommandResult 1\r\n";
    expect(readInChunks(error, [10, 20])).toEqual({ rows: [], rest: "Error: The branch 'br:/main/gone' does not exist.\nCommandResult 1\n" });
  });

  it('reads nothing from an empty output', () => {
    expect(readInChunks('', [])).toEqual({ rows: [], rest: '' });
  });

  it('reads a record bigger than many chunks', () => {
    const comment = 'ü'.repeat(300_000);
    const output = formatOutput(['1', comment], ['2', 'small']);
    // Odd offsets: every cut splits an `ü` in two.
    const cuts = Array.from({ length: 9 }, (_, index) => (index + 1) * 65_536 + 1);
    expect(readInChunks(output, cuts).rows).toEqual([
      ['1', comment],
      ['2', 'small'],
    ]);
  });

  it.each([
    ['records of many fields', (id: number) => [id, `/main/task${id % 2_000}`, id - 1, '2026-09-25T10:11:12.0000000+02:00', 'jane', `comment ${id}`]],
    ['records of one field', (id: number) => [id]],
  ])('reads each byte of a big output a few times, whatever its size: %s', (_, record) => {
    const output = Buffer.from(formatOutput(...Array.from({ length: 20_000 }, (_, id) => record(id))));
    const chunks = Array.from({ length: Math.ceil(output.length / 65_536) }, (_, index) => output.subarray(index * 65_536, (index + 1) * 65_536));
    const reader = new RecordReader((fields) => fields);

    const { bytesRead } = countBytesRead(() => chunks.forEach((chunk) => reader.read(chunk)));

    // About four reads of each byte (record separator, field separator, carriage return, decoding). A search per record
    // through the rest of its chunk reads each thousands of times; joining the chunks and splitting the whole, more.
    expect(bytesRead / output.length).toBeLessThan(5);
    expect(reader.count).toBe(20_000);
  });
});
