import { describe, expect, it } from 'vitest';
import { LineReader } from './LineReader';

/** The output read in chunks cut at every byte: the items, then the rest. */
function readByteByByte(output: string): { rows: string[]; rest: string } {
  const reader = new LineReader((line) => line);
  const bytes = Buffer.from(output, 'utf8');
  for (let index = 0; index < bytes.length; index++) reader.read(bytes.subarray(index, index + 1));
  const rest = reader.takeRest();
  return { rows: reader.finish(), rest };
}

describe('LineReader', () => {
  it('reads one item a line, however the chunks are cut, CRLF and blank lines dropped, characters of any script kept', () => {
    expect(readByteByByte('Administrators\r\nWeb Devs\r\n\r\n开发者 Ñandú\r\n')).toEqual({ rows: ['Administrators', 'Web Devs', '开发者 Ñandú'], rest: '' });
  });

  it("leaves a cm shell's result line as the rest, the shell's end, and reads every name before it", () => {
    expect(readByteByByte('ana@corp.com\nbob@corp.com\nCommandResult 0\n')).toEqual({ rows: ['ana@corp.com', 'bob@corp.com'], rest: 'CommandResult 0\n' });
  });

  it('reads a last line the output ends without a line break, as a process may print it', () => {
    expect(readByteByByte('ana@corp.com\nbob@corp.com')).toEqual({ rows: ['ana@corp.com', 'bob@corp.com'], rest: '' });
  });

  it('reads each line as soon as the next one starts', () => {
    const reader = new LineReader((line) => line);
    reader.read(Buffer.from('a\nb\nc', 'utf8'));
    expect(reader.count).toBe(1);
  });

  it('leaves out a line its caller builds nothing of', () => {
    const reader = new LineReader((line) => (line.startsWith('#') ? undefined : line));
    reader.read(Buffer.from('#skip\nkeep\n', 'utf8'));
    reader.takeRest();
    expect(reader.finish()).toEqual(['keep']);
  });
});
