import { describe, expect, it } from 'vitest';
import { countedText } from '@shared/testing/countedText';
import { OutputBuffer } from './OutputBuffer';
import { leftOutMarker } from './outputLimit';

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

  describe('keeping only its ends', () => {
    it('keeps everything while it fits', () => {
      const buffer = new OutputBuffer(5, 10);
      buffer.append('abcd');
      buffer.append('efgh');
      expect(buffer.textBefore(buffer.length)).toBe('abcdefgh');
    });

    it('keeps the first and the last half past it, the middle marked, however it was chunked', () => {
      const chunked = new OutputBuffer(5, 10);
      ['ab', 'cdefg', 'hijklmnop', 'qr', 's', 'tuvwxyz'].forEach((chunk) => chunked.append(chunk));
      const whole = new OutputBuffer(5, 10);
      whole.append('abcdefghijklmnopqrstuvwxyz');

      for (const buffer of [chunked, whole]) {
        expect(buffer.length).toBe(26);
        expect(buffer.tail).toBe('vwxyz');
        expect(buffer.textBefore(buffer.length)).toMatch(/^abcde\n… 1[0-6] more characters …\n[a-z]*vwxyz$/);
      }
      expect(whole.textBefore(whole.length)).toBe(`abcde${leftOutMarker(16)}vwxyz`);
    });

    it('leaves out what follows the end asked for, in the tail it kept', () => {
      const buffer = new OutputBuffer(5, 10);
      buffer.append('abcdefghijklmnopqrstuvwxyz');
      expect(buffer.textBefore(24)).toBe(`abcde${leftOutMarker(16)}vwx`);
    });

    it('holds about what it keeps however much arrives', () => {
      const buffer = new OutputBuffer(301, 1000);
      for (let i = 0; i < 10_000; i++) buffer.append(`line ${i}\n`);
      const text = buffer.textBefore(buffer.length);
      expect(text.startsWith('line 0\nline 1\n')).toBe(true);
      expect(text.endsWith('line 9999\n')).toBe(true);
      expect(text.length).toBeLessThan(1100);
    });
  });
});

