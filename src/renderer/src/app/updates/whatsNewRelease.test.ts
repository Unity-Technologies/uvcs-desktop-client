import { describe, expect, it } from 'vitest';
import type { MarkdownInline } from '../../lib/markdown';
import { fullChangelogLine, generatedItem, generatedNotes, group, note, paragraph, picture } from './testing/releaseNotesHtml';
import { whatsNewRelease, withoutAuthorTail } from './whatsNewRelease';

const text = (value: string) => ({ kind: 'text', text: value }) as const;
const titles = (html: string) => whatsNewRelease({ version: '0.2.5', html }).notes.map(({ kind, title }) => ({ kind, title }));

describe('a release written in groups of notes', () => {
  const html = [
    group('New'),
    note(
      'Run your own tools on files, changesets and branches',
      paragraph('Add the tools you use every day in <strong>Settings › Tools</strong>.'),
      picture('https://github.com/user-attachments/assets/0f3b', 'Settings › Tools'),
      '<h4 dir="auto">Placeholders</h4>',
      '<markdown-accessiblity-table><table role="table"><thead><tr><th align="left">Name</th></tr></thead><tbody><tr><td align="left">{path}</td></tr></tbody></table></markdown-accessiblity-table>',
    ),
    note('Format comments and mention people', paragraph('Type <kbd>@</kbd> to mention someone.')),
    group('Improved'),
    note('Hide the details panel the same way in every view', paragraph('Use the button in its header.')),
    group('Fixed'),
    note('Closing a window no longer stops what it’s doing', paragraph('The app waits for it to finish.')),
    group('Other changes'),
    '<ul dir="auto">\n<li>The palette finds branches by their description (<a class="issue-link js-issue-link" href="https://github.com/Unity-Technologies/uvcs-desktop-client/pull/162">#162</a>)</li>\n</ul>',
    fullChangelogLine('0.2.4', '0.2.5'),
  ].join('\n');

  it('reads each note under its group, with its title and its description', () => {
    const release = whatsNewRelease({ version: '0.2.5', html, releaseDate: '2026-10-30T12:00:00Z' });

    expect(release.version).toBe('0.2.5');
    expect(release.releaseDate).toBe('2026-10-30T12:00:00Z');
    expect(release.plain).toBe(false);
    expect(release.intro).toEqual([]);
    expect(release.notes.map(({ kind, title }) => ({ kind, title }))).toEqual([
      { kind: 'new', title: [text('Run your own tools on files, changesets and branches')] },
      { kind: 'new', title: [text('Format comments and mention people')] },
      { kind: 'improved', title: [text('Hide the details panel the same way in every view')] },
      { kind: 'fixed', title: [text('Closing a window no longer stops what it’s doing')] },
      {
        kind: 'other',
        title: [
          text('The palette finds branches by their description ('),
          { kind: 'link', url: 'https://github.com/Unity-Technologies/uvcs-desktop-client/pull/162', children: [text('#162')] },
          text(')'),
        ],
      },
    ]);
  });

  it("keeps a note's description whole: its pictures, its smaller headings and its tables", () => {
    const [first] = whatsNewRelease({ version: '0.2.5', html }).notes;

    expect(first!.description).toEqual([
      { kind: 'paragraph', children: [text('Add the tools you use every day in '), { kind: 'strong', children: [text('Settings › Tools')] }, text('.')] },
      { kind: 'paragraph', children: [{ kind: 'image', url: 'https://github.com/user-attachments/assets/0f3b', alt: 'Settings › Tools' }] },
      { kind: 'heading', level: 3, children: [text('Placeholders')] },
      { kind: 'table', align: ['left'], header: [[text('Name')]], rows: [[[text('{path}')]]] },
    ]);
  });

  it('leaves out the closing "Full Changelog" line', () => {
    const last = whatsNewRelease({ version: '0.2.5', html }).notes.at(-1)!;

    expect(last.description).toEqual([]);
  });

  it('reads a release with only fixes, in any letter case', () => {
    expect(titles([group('FIXED'), note('Árbol de ramas: los nombres largos se ven enteros'), note('名前の長いブランチ')].join('\n'))).toEqual([
      { kind: 'fixed', title: [text('Árbol de ramas: los nombres largos se ven enteros')] },
      { kind: 'fixed', title: [text('名前の長いブランチ')] },
    ]);
  });

  it('keeps what the release says before its first group as its introduction', () => {
    const release = whatsNewRelease({ version: '0.2.5', html: [paragraph('A big one.'), group('New'), note('Shelves')].join('\n') });

    expect(release.intro).toEqual([{ kind: 'paragraph', children: [text('A big one.')] }]);
    expect(release.notes).toHaveLength(1);
  });

  it('reads an unknown group as one other change, titled by its heading', () => {
    const release = whatsNewRelease({ version: '0.2.5', html: [group('New'), note('Shelves'), group('Before you update'), paragraph('Close Unity.')].join('\n') });

    expect(release.notes.at(-1)).toEqual({ kind: 'other', title: [text('Before you update')], description: [{ kind: 'paragraph', children: [text('Close Unity.')] }] });
  });

  it("reads text in a group outside any note as a note without a title, and a list item's sublist as its description", () => {
    const html = [group('Fixed'), paragraph('Several crashes.'), '<ul><li>Locks<ul><li>On Windows</li></ul></li></ul>'].join('\n');

    expect(whatsNewRelease({ version: '0.2.5', html }).notes).toEqual([
      { kind: 'fixed', title: [], description: [{ kind: 'paragraph', children: [text('Several crashes.')] }] },
      { kind: 'fixed', title: [text('Locks')], description: [{ kind: 'list', ordered: false, items: [{ children: [text('On Windows')] }] }] },
    ]);
  });
});

describe("GitHub's generated notes", () => {
  it('read as other changes, a pull request each, without who opened it and where', () => {
    const html = generatedNotes([
      generatedItem('Shelves’ comments can be edited, in their details and from their menu', 'danipen', 156),
      generatedItem('Every view’s details panel hides the same way: a header button, ⌘I or Ctrl+I', 'violetaGitHub', 160),
    ]);

    expect(whatsNewRelease({ version: '0.2.4', html })).toEqual({
      version: '0.2.4',
      releaseDate: null,
      intro: [],
      plain: false,
      notes: [
        { kind: 'other', title: [text('Shelves’ comments can be edited, in their details and from their menu')], description: [] },
        { kind: 'other', title: [text('Every view’s details panel hides the same way: a header button, ⌘I or Ctrl+I')], description: [] },
      ],
    });
  });

  it('leave out their new contributors', () => {
    const html = generatedNotes([generatedItem('Locks show who holds them', 'ana', 12)], { newContributors: ['ana'] });

    expect(titles(html)).toEqual([{ kind: 'other', title: [text('Locks show who holds them')] }]);
  });
});

describe('a pull request title without its author', () => {
  const tail = (title: MarkdownInline[]): MarkdownInline[] => [
    ...title.slice(0, -1),
    text(`${(title.at(-1) as { text: string }).text} by `),
    { kind: 'link', url: 'https://github.com/ana', children: [text('@ana')] },
    text(' in '),
    { kind: 'link', url: 'https://github.com/o/r/pull/7', children: [text('#7')] },
  ];

  it('keeps the marks of the title before it', () => {
    expect(withoutAuthorTail(tail([{ kind: 'code', text: 'cm find' }, text(' runs once')]))).toEqual([{ kind: 'code', text: 'cm find' }, text(' runs once')]);
  });

  it('keeps a title that only looks like one', () => {
    const lookalike = [text('Pick a branch by '), { kind: 'link', url: 'https://x.org', children: [text('name')] } as MarkdownInline, text(' in '), { kind: 'link', url: 'https://x.org/1', children: [text('#1')] } as MarkdownInline];

    expect(withoutAuthorTail(lookalike)).toEqual(lookalike);
    expect(withoutAuthorTail([text('Short')])).toEqual([text('Short')]);
  });
});

describe('notes written any other way', () => {
  it('read as plain Markdown, their headings included', () => {
    const html = ['<h2>Highlights</h2>', paragraph('Faster.'), '<h3>Under the hood</h3>', paragraph('Less work.')].join('\n');

    expect(whatsNewRelease({ version: '0.1.0', html })).toEqual({
      version: '0.1.0',
      releaseDate: null,
      plain: true,
      notes: [],
      intro: [
        { kind: 'heading', level: 2, children: [text('Highlights')] },
        { kind: 'paragraph', children: [text('Faster.')] },
        { kind: 'heading', level: 3, children: [text('Under the hood')] },
        { kind: 'paragraph', children: [text('Less work.')] },
      ],
    });
  });

  it('keep a "Full Changelog" line written anywhere but at the end', () => {
    const html = [fullChangelogLine('0.1.0', '0.1.1'), paragraph('More')].join('\n');

    expect(whatsNewRelease({ version: '0.1.1', html }).intro.map((block) => block.kind)).toEqual(['paragraph', 'paragraph']);
  });

  it('are empty when the release says nothing', () => {
    expect(whatsNewRelease({ version: '0.1.1', html: '' })).toEqual({ version: '0.1.1', releaseDate: null, plain: true, notes: [], intro: [] });
  });
});
