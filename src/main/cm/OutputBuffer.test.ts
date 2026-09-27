import { describe, expect, it } from 'vitest';
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

  it('takes a huge output in chunks in linear time', () => {
    const buffer = new OutputBuffer(301);
    const chunk = 'x'.repeat(65_535) + '\n';
    const start = performance.now();
    for (let index = 0; index < 1000; index++) {
      buffer.append(chunk);
      void buffer.tail.lastIndexOf('\n');
    }
    // 64 MB: about 5 ms here; one string appended to and read at its end took 2.3 s.
    expect(performance.now() - start).toBeLessThan(1000);
    expect(buffer.textBefore(buffer.length)).toHaveLength(65_536_000);
  });
});
