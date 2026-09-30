import { describe, expect, it } from 'vitest';
import { countedText } from '@shared/testing/countedText';
import { OutputBuffer } from './OutputBuffer';

describe('OutputBuffer', () => {
  it('keeps the end of what arrived, however it was chunked', () => {
    const buffer = new OutputBuffer(5);
    buffer.append('ab');
    expect(buffer.tail).toBe('ab');
    buffer.append('cdef');
    expect(buffer.tail).toBe('bcdef');
    buffer.append('0123456789');
    expect(buffer.tail).toBe('56789');
    buffer.append('x');
    expect(buffer.tail).toBe('6789x');
    expect(buffer.length).toBe(17);
    expect(buffer.textBefore(16)).toBe('abcdef0123456789');
  });

  it('starts over once cleared', () => {
    const buffer = new OutputBuffer(5);
    buffer.append('abc');
    buffer.clear();
    buffer.append('d');
    expect([buffer.tail, buffer.length, buffer.textBefore(1)]).toEqual(['d', 1, 'd']);
  });

  it('takes a huge output in chunks reading only the end of each, never joining them', () => {
    const buffer = new OutputBuffer(301);
    const chunks = Array.from({ length: 100 }, () => countedText('x'.repeat(65_535) + '\n'));
    for (const chunk of chunks) {
      buffer.append(chunk.text);
      void buffer.tail.lastIndexOf('\n');
    }
    // Joining each chunk to one string to read its end reads all of it: 64 MB that way took 2.3 s.
    expect(new Set(chunks.map((chunk) => chunk.charactersRead()))).toEqual(new Set([301]));
    expect(buffer.textBefore(buffer.length)).toHaveLength(6_553_600);
  });
});
