import { describe, expect, it } from 'vitest';
import { fenceLanguage, highlightedLanguage, MAX_HIGHLIGHTED_COMMENT_CHARS } from './codeBlockLanguage';

describe('fenceLanguage', () => {
  it('reads the language a fence names, in lower case, without what follows it', () => {
    expect(fenceLanguage('CSharp')).toBe('csharp');
    expect(fenceLanguage('ts title="a.ts"')).toBe('ts');
    expect(fenceLanguage('  ')).toBeNull();
    expect(fenceLanguage(undefined)).toBeNull();
  });
});

describe('highlightedLanguage', () => {
  it("highlights a block in its fence's language", () => {
    expect(highlightedLanguage('var a = 1;', 'csharp')).toBe('csharp');
  });

  it('leaves plain a block with no language, or one too big to highlight on the page without holding it', () => {
    expect(highlightedLanguage('var a = 1;', undefined)).toBeNull();
    expect(highlightedLanguage('x'.repeat(MAX_HIGHLIGHTED_COMMENT_CHARS + 1), 'json')).toBeNull();
    expect(highlightedLanguage('x'.repeat(MAX_HIGHLIGHTED_COMMENT_CHARS), 'json')).toBe('json');
  });
});
