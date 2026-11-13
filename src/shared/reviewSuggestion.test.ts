import { describe, expect, it } from 'vitest';
import { holdsSuggestion, suggestionFence, suggestionOf, withSuggestionAt } from './reviewSuggestion';

describe('suggestionOf', () => {
  it('reads the lines of a suggestion fence, the words around it left out', () => {
    expect(suggestionOf('Use the constant:\n```suggestion\nconst limit = MAX;\n```\nThanks')).toEqual({ lines: ['const limit = MAX;'] });
  });

  it('reads an empty fence as deleting the line, and one holding an empty line as emptying it', () => {
    expect(suggestionOf('```suggestion\n```')).toEqual({ lines: [] });
    expect(suggestionOf('```suggestion\n\n```')).toEqual({ lines: [''] });
  });

  it('reads several lines replacing the one, their indentation kept', () => {
    expect(suggestionOf('```suggestion\n  if (ready) {\n\tstart();\n  }\n```')).toEqual({ lines: ['  if (ready) {', '\tstart();', '  }'] });
  });

  it('reads Windows line ends as line ends, never into the lines', () => {
    expect(suggestionOf('Fix:\r\n```suggestion\r\nint a = 1;\r\nint b = 2;\r\n```\r\n')).toEqual({ lines: ['int a = 1;', 'int b = 2;'] });
  });

  it('takes the first suggestion only: the others are code, as GitHub takes one per comment', () => {
    expect(suggestionOf('```suggestion\nfirst\n```\n```suggestion\nsecond\n```')).toEqual({ lines: ['first'] });
  });

  it('skips a suggestion fence inside another fence, which is code', () => {
    const text = '````markdown\n```suggestion\nnot this\n```\n````\n```suggestion\nthis\n```';
    expect(suggestionOf(text)).toEqual({ lines: ['this'] });
    expect(suggestionOf('````\n```suggestion\nnot this\n```\n````')).toBeNull();
  });

  it('takes a suggestion with words after its language, as the fence names its language by its first word', () => {
    expect(suggestionOf('```suggestion title\nx\n```')).toEqual({ lines: ['x'] });
    expect(suggestionOf('```suggestions\nx\n```')).toBeNull();
    expect(suggestionOf('```Suggestion\nx\n```')).toBeNull();
  });

  it('reads tilde fences, closed only by tildes at least as many', () => {
    expect(suggestionOf('~~~suggestion\na\n```\n~~\nb\n~~~~\nafter')).toEqual({ lines: ['a', '```', '~~', 'b'] });
  });

  it('removes as much indentation as the opening fence had, and keeps the rest', () => {
    expect(suggestionOf('  ```suggestion\n    deeper\n x\n  ```')).toEqual({ lines: ['  deeper', 'x'] });
  });

  it("doesn't read a fence indented four spaces (indented code) or in a quote", () => {
    expect(suggestionOf('    ```suggestion\n    x\n    ```')).toBeNull();
    expect(suggestionOf('> ```suggestion\n> x\n> ```')).toBeNull();
  });

  it('runs an unclosed fence to the end of the text, not onto its last line end', () => {
    expect(suggestionOf('```suggestion\nx\n')).toEqual({ lines: ['x'] });
  });

  it("doesn't take inline code for a fence", () => {
    expect(suggestionOf('```suggestion``` x')).toBeNull();
    expect(suggestionOf('Just words')).toBeNull();
    expect(holdsSuggestion('```ts\nx\n```')).toBe(false);
  });
});

describe('suggestionFence', () => {
  it('fences the lines with three backticks', () => {
    expect(suggestionFence(['a', 'b'])).toBe('```suggestion\na\nb\n```');
    expect(suggestionFence([])).toBe('```suggestion\n```');
  });

  it('uses a longer fence than any run of backticks in the lines, so it reads back as written', () => {
    const fence = suggestionFence(['```', 'x']);
    expect(fence).toBe('````suggestion\n```\nx\n````');
    expect(suggestionOf(fence)).toEqual({ lines: ['```', 'x'] });
  });
});

describe('withSuggestionAt', () => {
  it('inserts the fence on lines of its own, the caret at the end of the suggested line', () => {
    const { text, caret } = withSuggestionAt('Use the constant.', 17, ['let a = 1;']);
    expect(text).toBe('Use the constant.\n```suggestion\nlet a = 1;\n```');
    expect(text.slice(0, caret).endsWith('let a = 1;')).toBe(true);
  });

  it('opens and closes a line around it in the middle of a text', () => {
    expect(withSuggestionAt('ab', 1, ['x']).text).toBe('a\n```suggestion\nx\n```\nb');
    // On an empty line, the fence takes it.
    expect(withSuggestionAt('a\n\nb', 2, ['x']).text).toBe('a\n```suggestion\nx\n```\nb');
  });

  it('inserts into an empty comment as it is, and reads back the lines', () => {
    const { text, caret } = withSuggestionAt('', 0, ['  return x;']);
    expect(text).toBe('```suggestion\n  return x;\n```');
    expect(caret).toBe('```suggestion\n  return x;'.length);
    expect(suggestionOf(text)).toEqual({ lines: ['  return x;'] });
  });
});
