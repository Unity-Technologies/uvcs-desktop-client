import { describe, expect, it } from 'vitest';
import { markdownPreview, parseInline, parseMarkdown, plainText } from './markdown';

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

  it('never links to other schemes: such a link shows its text', () => {
    expect(parseInline('[x](javascript:alert(1)) [y](file:///etc/passwd)')).toEqual([{ kind: 'text', text: 'x y' }]);
  });

  it("links to the app's own links", () => {
    expect(parseInline('[the fix](uvcs://local/repos/game/changesets/12)')).toEqual([
      { kind: 'link', url: 'uvcs://local/repos/game/changesets/12', children: [{ kind: 'text', text: 'the fix' }] },
    ]);
  });

  it('reads the first line of a heading, a list item or a quote without its marks', () => {
    expect(parseInline('## Fix **crash**')).toEqual([{ kind: 'text', text: 'Fix ' }, { kind: 'strong', children: [{ kind: 'text', text: 'crash' }] }]);
    expect(parseInline('- [x] Done')).toEqual([{ kind: 'text', text: 'Done' }]);
    expect(parseInline('> Quoted')).toEqual([{ kind: 'text', text: 'Quoted' }]);
  });

  it('reads strikethrough', () => {
    expect(parseInline('~~old~~ new')).toEqual([{ kind: 'strike', children: [{ kind: 'text', text: 'old' }] }, { kind: 'text', text: ' new' }]);
  });

  it('shows raw HTML as the text it is', () => {
    expect(parseInline('<b>bold</b> <script>x</script>')).toEqual([{ kind: 'text', text: '<b>bold</b> <script>x</script>' }]);
  });
});

describe('parseMarkdown with GitHub extensions', () => {
  it('reads tables with their alignment', () => {
    expect(parseMarkdown('| Case | After |\n| :-- | --: |\n| Switch | Kept |')).toEqual([
      {
        kind: 'table',
        align: ['left', 'right'],
        header: [[{ kind: 'text', text: 'Case' }], [{ kind: 'text', text: 'After' }]],
        rows: [[[{ kind: 'text', text: 'Switch' }], [{ kind: 'text', text: 'Kept' }]]],
      },
    ]);
  });

  it('reads task lists, nested lists and where a numbered list starts', () => {
    expect(parseMarkdown('- [x] Shelve\n- [ ] Switch\n  - Bring\n\n3. Third')).toEqual([
      {
        kind: 'list',
        ordered: false,
        items: [
          { children: [{ kind: 'text', text: 'Shelve' }], checked: true },
          {
            children: [{ kind: 'text', text: 'Switch' }],
            checked: false,
            sublist: { kind: 'list', ordered: false, items: [{ children: [{ kind: 'text', text: 'Bring' }] }] },
          },
        ],
      },
      { kind: 'list', ordered: true, start: 3, items: [{ children: [{ kind: 'text', text: 'Third' }] }] },
    ]);
  });

  it("keeps a code block's language, a rule and a quote's blocks", () => {
    expect(parseMarkdown('```csharp\nvar a = 1;\n```\n\n---\n\n> One\n>\n> - Two')).toEqual([
      { kind: 'code', text: 'var a = 1;', language: 'csharp' },
      { kind: 'rule' },
      {
        kind: 'quote',
        children: [
          { kind: 'paragraph', children: [{ kind: 'text', text: 'One' }] },
          { kind: 'list', ordered: false, items: [{ children: [{ kind: 'text', text: 'Two' }] }] },
        ],
      },
    ]);
  });

  it('reads images from the web only, and reference-style links', () => {
    expect(parseInline('![shot](https://example.com/a.png) ![local](file:///a.png) [docs][1]\n\n[1]: https://example.com/docs')).toEqual([
      { kind: 'image', url: 'https://example.com/a.png', alt: 'shot' },
      { kind: 'text', text: ' local ' },
      { kind: 'link', url: 'https://example.com/docs', children: [{ kind: 'text', text: 'docs' }] },
    ]);
  });
});

describe('parseMarkdown of a comment', () => {
  const comment = { comment: true };

  it('keeps each line break, as GitHub shows a comment', () => {
    expect(parseMarkdown('First line\nsecond line', comment)).toEqual([
      { kind: 'paragraph', children: [{ kind: 'text', text: 'First line' }, { kind: 'break' }, { kind: 'text', text: 'second line' }] },
    ]);
  });

  it('reads references in its text, never in code or in a link', () => {
    expect(parseInline('Fixes cs:12 for @ana, not `cs:13` nor [cs:14](https://x.com) :tada:', comment)).toEqual([
      { kind: 'text', text: 'Fixes ' },
      { kind: 'reference', reference: { kind: 'changeset', id: 12 }, source: 'cs:12' },
      { kind: 'text', text: ' for ' },
      { kind: 'reference', reference: { kind: 'user', name: 'ana' }, source: '@ana' },
      { kind: 'text', text: ', not ' },
      { kind: 'code', text: 'cs:13' },
      { kind: 'text', text: ' nor ' },
      { kind: 'link', url: 'https://x.com', children: [{ kind: 'text', text: 'cs:14' }] },
      { kind: 'text', text: ' ' },
      { kind: 'reference', reference: { kind: 'emoji', name: 'tada', glyph: '🎉' }, source: ':tada:' },
    ]);
  });

  it('reads a person named by an email address as the person, not a mail link', () => {
    expect(parseInline('Thanks @ana@acme.com!', comment)).toEqual([
      { kind: 'text', text: 'Thanks ' },
      { kind: 'reference', reference: { kind: 'user', name: 'ana@acme.com' }, source: '@ana@acme.com' },
      { kind: 'text', text: '!' },
    ]);
  });

  it('keeps underscores and stars in names and paths as written', () => {
    expect(parseInline('br:/main/task_22_fix and *.meta files', comment)).toEqual([
      { kind: 'reference', reference: { kind: 'branch', name: '/main/task_22_fix' }, source: 'br:/main/task_22_fix' },
      { kind: 'text', text: ' and *.meta files' },
    ]);
  });

  it('reads references only in comments', () => {
    expect(parseInline('cs:12')).toEqual([{ kind: 'text', text: 'cs:12' }]);
  });
});

describe('plainText', () => {
  it('writes references as written, emoji as themselves and images by their description', () => {
    expect(plainText(parseInline('See cs:12 :tada: ![the dialog](https://x.com/a.png)', { comment: true }))).toBe('See cs:12 🎉 the dialog');
  });
});

describe('markdownPreview', () => {
  it('flattens the text to one line without marks', () => {
    expect(markdownPreview('## Fixes\n- **Crash** on start\n- Slow `load`')).toBe('Fixes — Crash on start · Slow load');
  });
});

describe('parseMarkdown of a comment, what Markdown reads around a reference', () => {
  const comment = { comment: true };

  it('keeps a repository on a server named by its host whole, never a mail link', () => {
    expect(parseInline('See cs:12@game@build.acme.com:8087 now', comment)).toEqual([
      { kind: 'text', text: 'See ' },
      { kind: 'reference', reference: { kind: 'changeset', id: 12, repository: 'game@build.acme.com:8087' }, source: 'cs:12@game@build.acme.com:8087' },
      { kind: 'text', text: ' now' },
    ]);
  });

  it('keeps a path with underscores whole, never emphasis', () => {
    expect(parseInline('serverpath:/src/__init__.py#cs:3', comment)).toEqual([
      { kind: 'reference', reference: { kind: 'file', path: '/src/__init__.py', at: { kind: 'changeset', id: 3 } }, source: 'serverpath:/src/__init__.py#cs:3' },
    ]);
  });

  it('reads a reference inside emphasis', () => {
    expect(parseInline('**cs:12** and _br:/main_', comment)).toEqual([
      { kind: 'strong', children: [{ kind: 'reference', reference: { kind: 'changeset', id: 12 }, source: 'cs:12' }] },
      { kind: 'text', text: ' and ' },
      { kind: 'emphasis', children: [{ kind: 'reference', reference: { kind: 'branch', name: '/main' }, source: 'br:/main' }] },
    ]);
  });

  it('shows a bare email address as text: the app opens no mail links', () => {
    expect(parseInline('Ask ana@acme.com', comment)).toEqual([{ kind: 'text', text: 'Ask ana@acme.com' }]);
    expect(parseInline('[mail](mailto:ana@acme.com)')).toEqual([{ kind: 'text', text: 'mail' }]);
  });

  it('leaves a bare web address whole, references in it included', () => {
    expect(parseInline('CI: https://ci.acme.com/job?BRANCH=br:/main/task done', { comment: true })).toEqual([
      { kind: 'text', text: 'CI: ' },
      { kind: 'link', url: 'https://ci.acme.com/job?BRANCH=br:/main/task', children: [{ kind: 'text', text: 'https://ci.acme.com/job?BRANCH=br:/main/task' }] },
      { kind: 'text', text: ' done' },
    ]);
  });

  it('keeps text that looks like a placeholder as it is', () => {
    expect(parseInline('Icons \uE0007\uE001 here', { comment: true })).toEqual([{ kind: 'text', text: 'Icons \uE0007\uE001 here' }]);
  });
});

describe('keys in a comment', () => {
  it('reads <kbd> as a key, as GitHub does, and leaves any other HTML as text', () => {
    expect(parseInline('Press <kbd>Ctrl</kbd>+<kbd>F</kbd> or <KBD>⌘F</KBD>, not <b>this</b>')).toEqual([
      { kind: 'text', text: 'Press ' },
      { kind: 'key', text: 'Ctrl' },
      { kind: 'text', text: '+' },
      { kind: 'key', text: 'F' },
      { kind: 'text', text: ' or ' },
      { kind: 'key', text: '⌘F' },
      { kind: 'text', text: ', not <b>this</b>' },
    ]);
  });

  it('keeps a key written as text inside it, a reference included, and an unclosed <kbd> as text', () => {
    expect(parseInline('<kbd>cs:12</kbd> and <kbd>Esc', { comment: true })).toEqual([
      { kind: 'key', text: 'cs:12' },
      { kind: 'text', text: ' and <kbd>Esc' },
    ]);
  });

  it('writes a key as its text', () => {
    expect(plainText(parseInline('<kbd>Ctrl</kbd>+<kbd>F</kbd>'))).toBe('Ctrl+F');
  });

  it('reads a key inside a link or emphasis, and a key in a key as the text around it', () => {
    expect(parseInline('**<kbd>Esc</kbd>** [<kbd>F1</kbd>](https://x.com)')).toEqual([
      { kind: 'strong', children: [{ kind: 'key', text: 'Esc' }] },
      { kind: 'text', text: ' ' },
      { kind: 'link', url: 'https://x.com', children: [{ kind: 'key', text: 'F1' }] },
    ]);
    expect(parseInline('<kbd><kbd>a</kbd></kbd>')).toEqual([{ kind: 'text', text: '<kbd>' }, { kind: 'key', text: 'a' }, { kind: 'text', text: '</kbd>' }]);
  });

  it('reads a key across a line break as one line, and an empty key as nothing', () => {
    expect(parseInline('<kbd>Ctrl\nF</kbd>', { comment: true })).toEqual([{ kind: 'key', text: 'Ctrl F' }]);
    expect(parseInline('Press <kbd></kbd> now')).toEqual([{ kind: 'text', text: 'Press  now' }]);
  });
});

