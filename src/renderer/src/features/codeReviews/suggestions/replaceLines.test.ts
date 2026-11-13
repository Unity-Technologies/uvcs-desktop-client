import { describe, expect, it } from 'vitest';
import { withLinesReplaced } from './replaceLines';

describe('withLinesReplaced', () => {
  it('replaces a line, the others as they were', () => {
    expect(withLinesReplaced('a\nb\nc\n', 2, 2, ['B'])).toBe('a\nB\nc\n');
  });

  it('keeps Windows line ends, the new lines taking them too', () => {
    expect(withLinesReplaced('a\r\nb\r\nc\r\n', 2, 2, ['b1', 'b2'])).toBe('a\r\nb1\r\nb2\r\nc\r\n');
  });

  it("takes the replaced line's own line end in a file of mixed ones", () => {
    expect(withLinesReplaced('a\nb\r\nc\n', 2, 2, ['x', 'y'])).toBe('a\nx\r\ny\r\nc\n');
    expect(withLinesReplaced('a\r\nb\nc\r\n', 2, 2, ['x', 'y'])).toBe('a\r\nx\ny\nc\r\n');
  });

  it('deletes a line with its line end', () => {
    expect(withLinesReplaced('a\r\nb\r\nc\r\n', 2, 2, [])).toBe('a\r\nc\r\n');
    expect(withLinesReplaced('a\nb\nc\n', 3, 3, [])).toBe('a\nb\n');
  });

  it('keeps a last line without a line end so, whether replaced or deleted', () => {
    expect(withLinesReplaced('a\r\nb', 2, 2, ['x', 'y'])).toBe('a\r\nx\r\ny');
    expect(withLinesReplaced('a\nb', 2, 2, [])).toBe('a');
    expect(withLinesReplaced('only', 1, 1, ['x', 'y'])).toBe('x\ny');
    expect(withLinesReplaced('only', 1, 1, [])).toBe('');
  });

  it('empties a line with an empty suggested line', () => {
    expect(withLinesReplaced('a\nb\nc', 2, 2, [''])).toBe('a\n\nc');
  });

  it('keeps the byte order mark when the first line changes', () => {
    expect(withLinesReplaced('﻿using System;\r\nclass A {}\r\n', 1, 1, ['using System.IO;'])).toBe('﻿using System.IO;\r\nclass A {}\r\n');
    expect(withLinesReplaced('﻿a\nb\n', 1, 1, [])).toBe('﻿b\n');
  });

  it('replaces a range of lines, for a comment on several', () => {
    expect(withLinesReplaced('a\nb\nc\nd\n', 2, 3, ['x'])).toBe('a\nx\nd\n');
  });

  it('refuses lines past the end of the file', () => {
    expect(withLinesReplaced('a\nb\n', 3, 3, ['x'])).toBeNull();
    expect(withLinesReplaced('', 1, 1, ['x'])).toBeNull();
  });
});
