import { describe, expect, it } from 'vitest';
import { highlightsSyntax, MAX_HIGHLIGHTED_CHARS } from './syntaxHighlighting';

describe('highlightsSyntax', () => {
  it('highlights files of any usual size', () => {
    expect(highlightsSyntax('a'.repeat(200_000), 'b'.repeat(200_000))).toBe(true);
    expect(highlightsSyntax('', 'x'.repeat(MAX_HIGHLIGHTED_CHARS))).toBe(true);
  });

  it('shows huge files as plain text, counting both versions', () => {
    expect(highlightsSyntax('a'.repeat(MAX_HIGHLIGHTED_CHARS / 2), 'b'.repeat(MAX_HIGHLIGHTED_CHARS / 2 + 1))).toBe(false);
    expect(highlightsSyntax('', 'x'.repeat(MAX_HIGHLIGHTED_CHARS + 1))).toBe(false);
  });
});
