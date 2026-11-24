import { describe, expect, it } from 'vitest';
import { MAX_HIGHLIGHTED_COMMENT_CHARS } from '../../../components/comments/codeBlockLanguage';
import { suggestionLanguage } from './suggestionLanguage';

describe('suggestionLanguage', () => {
  it("highlights in the file's language", () => {
    expect(suggestionLanguage('int a = 1;', 'Assets/Scripts/Player.cs')).toBe('csharp');
  });

  it("shows plain a file whose language isn't known, or rows past a comment's highlighted size", () => {
    expect(suggestionLanguage('x', 'notes.unknownext')).toBeNull();
    expect(suggestionLanguage('x'.repeat(MAX_HIGHLIGHTED_COMMENT_CHARS + 1), 'Player.cs')).toBeNull();
  });
});
