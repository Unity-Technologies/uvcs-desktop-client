import { describe, expect, it } from 'vitest';
import { suggestionOf } from './reviewSuggestion';
import { parseMarkdown, suggestionBlockIndex } from './markdown';

/** The block shown as the suggestion, and its text as Markdown reads it: what `suggestionOf` must agree with. */
function shownSuggestion(text: string): string | null {
  const blocks = parseMarkdown(text, { comment: true });
  const block = blocks[suggestionBlockIndex(blocks)];
  return block?.kind === 'code' ? block.text : null;
}

/** What `suggestionOf` reads, as Markdown would show it. */
function readSuggestion(text: string): string | null {
  return suggestionOf(text)?.lines.join('\n') ?? null;
}

describe('suggestionBlockIndex', () => {
  it.each([
    ['words then a suggestion', 'Use it:\n```suggestion\nconst a = 1;\n```\nThanks'],
    ['Windows line ends', 'Use it:\r\n```suggestion\r\nconst a = 1;\r\n```'],
    ['two suggestions, the first taken', '```suggestion\none\n```\n\n```suggestion\ntwo\n```'],
    ['one inside another fence, then one of its own', '````md\n```suggestion\nno\n```\n````\n```suggestion\nyes\n```'],
    ['words after its language', '```suggestion title\nx\n```'],
    ['tildes', '~~~suggestion\n```\nx\n~~~'],
    ['indented fence', '  ```suggestion\n    deeper\n  ```'],
    ['several lines', '```suggestion\n  a\n\tb\n```'],
    ['an unclosed fence', '```suggestion\nx\n'],
  ])('shows the block suggestionOf reads: %s', (_name, text) => {
    expect(shownSuggestion(text)).toBe(readSuggestion(text));
    expect(shownSuggestion(text)).not.toBeNull();
  });

  it.each([
    ['a quote', '> ```suggestion\n> x\n> ```'],
    ['a list', '- item\n  ```suggestion\n  x\n  ```'],
    ['another fence only', '````\n```suggestion\nx\n```\n````'],
    ['another language', '```ts\nx\n```'],
  ])('reads and shows none for a fence that is no block of its own: %s', (_name, text) => {
    expect(suggestionBlockIndex(parseMarkdown(text, { comment: true }))).toBe(-1);
    expect(readSuggestion(text)).toBeNull();
  });
});
