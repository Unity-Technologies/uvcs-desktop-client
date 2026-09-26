import { describe, expect, it } from 'vitest';
import { MAX_BACKGROUND_HIGHLIGHTED_CHARS, MAX_HIGHLIGHTED_CHARS, syntaxHighlighting } from './syntaxHighlighting';

describe('syntaxHighlighting', () => {
  it('highlights files of any usual size before showing them', () => {
    expect(syntaxHighlighting('a'.repeat(200_000), 'b'.repeat(200_000), true)).toBe('inline');
    expect(syntaxHighlighting('', 'x'.repeat(MAX_HIGHLIGHTED_CHARS), false)).toBe('inline');
  });

  it('highlights a big read-only diff in the background, counting both versions', () => {
    expect(syntaxHighlighting('a'.repeat(MAX_HIGHLIGHTED_CHARS / 2), 'b'.repeat(MAX_HIGHLIGHTED_CHARS / 2 + 1), false)).toBe('background');
    expect(syntaxHighlighting('', 'x'.repeat(MAX_BACKGROUND_HIGHLIGHTED_CHARS), false)).toBe('background');
  });

  it('shows a big editable diff as plain text: Pierre would highlight it on the main thread', () => {
    expect(syntaxHighlighting('a'.repeat(MAX_HIGHLIGHTED_CHARS / 2), 'b'.repeat(MAX_HIGHLIGHTED_CHARS / 2 + 1), true)).toBe('off');
  });

  it('shows huge files as plain text', () => {
    expect(syntaxHighlighting('', 'x'.repeat(MAX_BACKGROUND_HIGHLIGHTED_CHARS + 1), false)).toBe('off');
  });
});
