import { highlightTree } from '@lezer/highlight';
import { describe, expect, it } from 'vitest';
import { commentMarkdown, commentMarkdownStyle } from './commentLanguage';

/** The text of each span the editor gives `className`, in order. */
function textsWithClass(text: string, className: string): string[] {
  const tree = commentMarkdown().language.parser.parse(text);
  const texts: string[] = [];
  highlightTree(tree, commentMarkdownStyle, (from, to, classes) => {
    if (classes.split(' ').includes(className)) texts.push(text.slice(from, to));
  });
  return texts;
}

describe('commentMarkdownStyle', () => {
  it('draws inline code as inline code, its backticks as marks', () => {
    expect(textsWithClass('Use `Shelve()` first', 'cm-inlineCode')).toEqual(['Shelve()']);
  });

  it("leaves a code block's text to the code block, as a shown comment does, with or without a language", () => {
    const text = ['```', 'plain', '```', '', '```cs', 'var x = 1;', '```', '', '    indented'].join('\n');
    expect(textsWithClass(text, 'cm-inlineCode')).toEqual([]);
  });
});
