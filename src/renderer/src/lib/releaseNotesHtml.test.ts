import { describe, expect, it } from 'vitest';
import { releaseNotesFromHtml } from './releaseNotesHtml';

const text = (value: string) => ({ kind: 'text', text: value }) as const;

describe('release notes as GitHub renders them', () => {
  it("reads GitHub's generated notes: a heading, a list of pull requests and the full changelog", () => {
    const html = [
      '<h2>What\'s Changed</h2>',
      '<ul>',
      '<li>Shelves open from the palette by <a class="user-mention notranslate" data-hovercard-type="user" href="https://github.com/ana">@ana</a> in <a class="issue-link js-issue-link" href="https://github.com/Unity-Technologies/uvcs-desktop-client/pull/12">#12</a></li>',
      '</ul>',
      '<p><strong>Full Changelog</strong>: <a class="commit-link" href="https://github.com/Unity-Technologies/uvcs-desktop-client/compare/v1.2.0...v1.3.0"><tt>v1.2.0...v1.3.0</tt></a></p>',
    ].join('\n');

    expect(releaseNotesFromHtml(html)).toEqual([
      { kind: 'heading', level: 2, children: [text("What's Changed")] },
      {
        kind: 'list',
        ordered: false,
        items: [
          {
            children: [
              text('Shelves open from the palette by '),
              { kind: 'link', url: 'https://github.com/ana', children: [text('@ana')] },
              text(' in '),
              { kind: 'link', url: 'https://github.com/Unity-Technologies/uvcs-desktop-client/pull/12', children: [text('#12')] },
            ],
          },
        ],
      },
      {
        kind: 'paragraph',
        children: [
          { kind: 'strong', children: [text('Full Changelog')] },
          text(': '),
          { kind: 'link', url: 'https://github.com/Unity-Technologies/uvcs-desktop-client/compare/v1.2.0...v1.3.0', children: [text('v1.2.0...v1.3.0')] },
        ],
      },
    ]);
  });

  it('keeps emphasis, inline code, quotes and code blocks', () => {
    const html = '<p><em>Faster</em> <code>cm find</code></p><blockquote>\n<p>Note</p>\n</blockquote><pre><code>npm start\nnpm test\n</code></pre>';

    expect(releaseNotesFromHtml(html)).toEqual([
      { kind: 'paragraph', children: [{ kind: 'emphasis', children: [text('Faster')] }, text(' '), { kind: 'code', text: 'cm find' }] },
      { kind: 'quote', children: [text('Note')] },
      { kind: 'code', text: 'npm start\nnpm test' },
    ]);
  });

  it('reads headings of every level, the smaller ones as the smallest heading', () => {
    expect(releaseNotesFromHtml('<h1>A</h1><h3>B</h3><h6>C</h6>')).toEqual([
      { kind: 'heading', level: 1, children: [text('A')] },
      { kind: 'heading', level: 3, children: [text('B')] },
      { kind: 'heading', level: 3, children: [text('C')] },
    ]);
  });

  it('decodes character references, the Unicode ones too', () => {
    expect(releaseNotesFromHtml('<p>Fish &amp; chips &lt;3 &#x1F680; &#233;t&#xE9; &quot;x&quot;&nbsp;y</p>')).toEqual([
      { kind: 'paragraph', children: [text('Fish & chips <3 🚀 été "x"\u00a0y')] },
    ]);
  });

  it('collapses white space and line breaks as a browser shows them', () => {
    expect(releaseNotesFromHtml('<p>  One\r\n   line<br>and\tanother  </p>')).toEqual([{ kind: 'paragraph', children: [text('One line and another')] }]);
  });

  it('reads loose list items, with paragraphs inside, as one line each', () => {
    expect(releaseNotesFromHtml('<ol>\n<li>\n<p>First</p>\n</li>\n<li><p>Second</p></li>\n</ol>')).toEqual([
      { kind: 'list', ordered: true, items: [{ children: [text('First')] }, { children: [text('Second')] }] },
    ]);
  });

  it('keeps a nested list under its item', () => {
    expect(releaseNotesFromHtml('<ul><li>Branches<ol><li>Rename</li><li>Delete</li></ol></li><li>Labels</li></ul>')).toEqual([
      {
        kind: 'list',
        ordered: false,
        items: [
          { children: [text('Branches')], sublist: { kind: 'list', ordered: true, items: [{ children: [text('Rename')] }, { children: [text('Delete')] }] } },
          { children: [text('Labels')] },
        ],
      },
    ]);
  });

  it('keeps an item that holds only a nested list, and joins two nested lists into one', () => {
    const [list] = releaseNotesFromHtml('<ul><li><ul><li>A</li></ul><ul><li>B</li></ul></li></ul>');

    expect(list).toEqual({
      kind: 'list',
      ordered: false,
      items: [{ children: [], sublist: { kind: 'list', ordered: false, items: [{ children: [text('A')] }, { children: [text('B')] }] } }],
    });
  });

  it('reads text outside any block as a paragraph', () => {
    expect(releaseNotesFromHtml('Just a line <strong>bold</strong><p>Then a paragraph</p>')).toEqual([
      { kind: 'paragraph', children: [text('Just a line '), { kind: 'strong', children: [text('bold')] }] },
      { kind: 'paragraph', children: [text('Then a paragraph')] },
    ]);
  });

  it('reads a table as a paragraph a row, and a collapsed section as its text', () => {
    const html = '<table><thead><tr><th>OS</th><th>File</th></tr></thead><tbody><tr><td>macOS</td><td>dmg</td></tr></tbody></table><details><summary>More</summary><p>Hidden</p></details>';

    expect(releaseNotesFromHtml(html)).toEqual([
      { kind: 'paragraph', children: [text('OS File')] },
      { kind: 'paragraph', children: [text('macOS dmg')] },
      { kind: 'paragraph', children: [text('More')] },
      { kind: 'paragraph', children: [text('Hidden')] },
    ]);
  });

  it('is empty for notes with nothing to read', () => {
    expect(releaseNotesFromHtml('')).toEqual([]);
    expect(releaseNotesFromHtml('\n<p> </p>\n<hr>\n')).toEqual([]);
  });
});

describe('what never reaches the page', () => {
  it('leaves out scripts, styles and comments with everything in them', () => {
    const html = '<p>Before</p><script>alert("<p>x</p>")</script><style>p { color: red }</style><!-- a <p>comment</p> --><p>After</p>';

    expect(releaseNotesFromHtml(html)).toEqual([
      { kind: 'paragraph', children: [text('Before')] },
      { kind: 'paragraph', children: [text('After')] },
    ]);
  });

  it('leaves out images, keeping the link around one only when it has text', () => {
    const html = '<p><a href="https://github.com/user-attachments/assets/1"><img src="https://github.com/user-attachments/assets/1" alt="Screenshot"></a></p><p>A <img src="x.png"> picture</p>';

    expect(releaseNotesFromHtml(html)).toEqual([{ kind: 'paragraph', children: [text('A picture')] }]);
  });

  it('keeps only web links: any other address reads as its text', () => {
    const html = '<p><a href="javascript:alert(1)">run</a> <a href="#fixes">jump</a> <a href=\'file:///etc/passwd\'>file</a> <a href=HTTPS://example.com>web</a></p>';

    expect(releaseNotesFromHtml(html)).toEqual([
      {
        kind: 'paragraph',
        children: [text('run jump file '), { kind: 'link', url: 'HTTPS://example.com', children: [text('web')] }],
      },
    ]);
  });

  it('reads a character reference in a link as its character, not as part of the address', () => {
    expect(releaseNotesFromHtml('<p><a href="https://example.com/?a=1&amp;b=2">x</a></p>')).toEqual([
      { kind: 'paragraph', children: [{ kind: 'link', url: 'https://example.com/?a=1&b=2', children: [text('x')] }] },
    ]);
  });

  it('survives broken markup: stray end tags, unclosed elements and a lone angle bracket', () => {
    expect(releaseNotesFromHtml('</div><p>a < b <strong>open</p><p>next</p></em>')).toEqual([
      { kind: 'paragraph', children: [text('a < b '), { kind: 'strong', children: [text('open')] }] },
      { kind: 'paragraph', children: [text('next')] },
    ]);
  });
});
