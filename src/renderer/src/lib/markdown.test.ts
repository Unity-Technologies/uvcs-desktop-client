import { describe, expect, it } from 'vitest';
import { markdownPreview, parseInline, parseMarkdown } from './markdown';

describe('parseMarkdown', () => {
  it('reads headings, paragraphs, lists, quotes and code blocks', () => {
    const blocks = parseMarkdown('## Fixes\n\nThe game\nno longer crashes.\n\n- Faster load\n- Smaller build\n\n1. First\n2. Second\n\n> Note\n\n```\nnpm test\n```');
    expect(blocks.map((block) => block.kind)).toEqual(['heading', 'paragraph', 'list', 'list', 'quote', 'code']);
    expect(blocks[0]).toEqual({ kind: 'heading', level: 2, children: [{ kind: 'text', text: 'Fixes' }] });
    expect(blocks[1]).toEqual({ kind: 'paragraph', children: [{ kind: 'text', text: 'The game no longer crashes.' }] });
    expect(blocks[2]).toMatchObject({ kind: 'list', ordered: false, items: [{ children: [{ text: 'Faster load' }] }, { children: [{ text: 'Smaller build' }] }] });
    expect(blocks[3]).toMatchObject({ kind: 'list', ordered: true });
    expect(blocks[5]).toEqual({ kind: 'code', text: 'npm test' });
  });

  it('ends a paragraph where a list starts', () => {
    expect(parseMarkdown('Changes:\n- One').map((block) => block.kind)).toEqual(['paragraph', 'list']);
  });

  it('reads lines indented after a blank line as code, each line kept', () => {
    const comment = 'Commands:\n\n    cm codereview comment 1234 "Looks good"\n\n\tcm codereview reviewer add 1234 alice\n\nThe end.';
    expect(parseMarkdown(comment)).toEqual([
      { kind: 'paragraph', children: [{ kind: 'text', text: 'Commands:' }] },
      { kind: 'code', text: 'cm codereview comment 1234 "Looks good"\n\ncm codereview reviewer add 1234 alice' },
      { kind: 'paragraph', children: [{ kind: 'text', text: 'The end.' }] },
    ]);
  });

  it('keeps an indented line right under a paragraph in the paragraph', () => {
    expect(parseMarkdown('Wraps here\n    and goes on')).toEqual([{ kind: 'paragraph', children: [{ kind: 'text', text: 'Wraps here and goes on' }] }]);
  });

  it('caps heading levels at three', () => {
    expect(parseMarkdown('##### Deep')[0]).toMatchObject({ kind: 'heading', level: 3 });
  });
});

describe('parseInline', () => {
  it('reads code, links, strong and emphasis', () => {
    expect(parseInline('Run `cm up`, see [docs](https://example.com) **now** or *later*')).toEqual([
      { kind: 'text', text: 'Run ' },
      { kind: 'code', text: 'cm up' },
      { kind: 'text', text: ', see ' },
      { kind: 'link', url: 'https://example.com', children: [{ kind: 'text', text: 'docs' }] },
      { kind: 'text', text: ' ' },
      { kind: 'strong', children: [{ kind: 'text', text: 'now' }] },
      { kind: 'text', text: ' or ' },
      { kind: 'emphasis', children: [{ kind: 'text', text: 'later' }] },
    ]);
  });

  it('links bare URLs without the punctuation after them', () => {
    expect(parseInline('Results: https://ci.example.com/42.')).toEqual([
      { kind: 'text', text: 'Results: ' },
      { kind: 'link', url: 'https://ci.example.com/42', children: [{ kind: 'text', text: 'https://ci.example.com/42' }] },
      { kind: 'text', text: '.' },
    ]);
  });

  it('leaves snake_case words alone', () => {
    expect(parseInline('merge_only_reviewed')).toEqual([{ kind: 'text', text: 'merge_only_reviewed' }]);
  });

  it('never reads links to other schemes', () => {
    expect(parseInline('[x](javascript:alert(1))')).toEqual([{ kind: 'text', text: '[x](javascript:alert(1))' }]);
  });
});

describe('markdownPreview', () => {
  it('flattens the text to one line without marks', () => {
    expect(markdownPreview('## Fixes\n- **Crash** on start\n- Slow `load`')).toBe('Fixes — Crash on start · Slow load');
  });
});
