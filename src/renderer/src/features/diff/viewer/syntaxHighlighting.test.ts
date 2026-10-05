import { describe, expect, it } from 'vitest';
import { highlightedLanguage, MAX_BACKGROUND_HIGHLIGHTED_CHARS, MAX_HIGHLIGHTED_CHARS, MAX_READ_ONLY_HIGHLIGHTED_CHARS, plainTextThresholdLabel, syntaxHighlighting } from './syntaxHighlighting';

describe('syntaxHighlighting', () => {
  it('highlights a small editable diff before showing it, and a bigger one in the background, counting both versions', () => {
    expect(syntaxHighlighting('', 'x'.repeat(MAX_READ_ONLY_HIGHLIGHTED_CHARS), true)).toBe('inline');
    expect(syntaxHighlighting('a'.repeat(MAX_READ_ONLY_HIGHLIGHTED_CHARS / 2), 'b'.repeat(MAX_READ_ONLY_HIGHLIGHTED_CHARS / 2 + 1), true)).toBe('background');
    expect(syntaxHighlighting('a'.repeat(200_000), 'b'.repeat(200_000), true)).toBe('background');
  });

  it('highlights a small read-only diff before showing it, and a bigger one in the background, counting both versions', () => {
    expect(syntaxHighlighting('', 'x'.repeat(MAX_READ_ONLY_HIGHLIGHTED_CHARS), false)).toBe('inline');
    expect(syntaxHighlighting('a'.repeat(MAX_READ_ONLY_HIGHLIGHTED_CHARS / 2), 'b'.repeat(MAX_READ_ONLY_HIGHLIGHTED_CHARS / 2 + 1), false)).toBe('background');
    expect(syntaxHighlighting('a'.repeat(MAX_HIGHLIGHTED_CHARS / 2), 'b'.repeat(MAX_HIGHLIGHTED_CHARS / 2 + 1), false)).toBe('background');
    expect(syntaxHighlighting('', 'x'.repeat(MAX_BACKGROUND_HIGHLIGHTED_CHARS), false)).toBe('background');
  });

  it('shows a big editable diff as plain text: Pierre highlights it on the main thread when the editor attaches early', () => {
    expect(syntaxHighlighting('a'.repeat(MAX_HIGHLIGHTED_CHARS / 2), 'b'.repeat(MAX_HIGHLIGHTED_CHARS / 2 + 1), true)).toBe('off');
  });

  it('shows huge files as plain text', () => {
    expect(syntaxHighlighting('', 'x'.repeat(MAX_BACKGROUND_HIGHLIGHTED_CHARS + 1), false)).toBe('off');
  });
});

describe('plainTextThresholdLabel', () => {
  it('names the size past which a diff is plain text, by whether it is editable', () => {
    expect(plainTextThresholdLabel(true)).toBe('400 KB');
    expect(plainTextThresholdLabel(false)).toBe('4 MB');
  });
});

describe('highlightedLanguage', () => {
  it("is the file's language while it's highlighted", () => {
    expect(highlightedLanguage('inline', 'app.ts')).toBe('typescript');
    expect(highlightedLanguage('background', 'icon.svg')).toBe('xml');
  });

  it('is plain text otherwise, so lines typed into a plain-text diff stay plain', () => {
    expect(highlightedLanguage('off', 'app.ts')).toBe('text');
  });
});
