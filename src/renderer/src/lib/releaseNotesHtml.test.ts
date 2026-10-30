import { describe, expect, it } from 'vitest';
import { releaseNotesFromHtml, releaseNotesOutline } from './releaseNotesHtml';

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
      { kind: 'quote', children: [{ kind: 'paragraph', children: [text('Note')] }] },
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

  it('reads a table as GitHub renders one: in its accessibility box, each column aligned as written', () => {
    const html = [
      '<markdown-accessiblity-table><table role="table">',
      '<thead>\n<tr>\n<th align="left">Key</th>\n<th align="center">Does</th>\n<th>Where</th>\n</tr>\n</thead>',
      '<tbody>\n<tr>\n<td align="left"><kbd>⌘I</kbd></td>\n<td align="center">Hides the <strong>details</strong></td>\n<td>Every view</td>\n</tr>',
      '<tr>\n<td align="left">⌘⇧L</td>\n<td align="center">Shows the log</td>\n<td>Ñandú</td>\n</tr>\n</tbody>',
      '</table></markdown-accessiblity-table>',
    ].join('\n');

    expect(releaseNotesFromHtml(html)).toEqual([
      {
        kind: 'table',
        align: ['left', 'center', null],
        header: [[text('Key')], [text('Does')], [text('Where')]],
        rows: [
          [[{ kind: 'code', text: '⌘I' }], [text('Hides the '), { kind: 'strong', children: [text('details')] }], [text('Every view')]],
          [[text('⌘⇧L')], [text('Shows the log')], [text('Ñandú')]],
        ],
      },
    ]);
  });

  it("reads a table without a head, its first row as the header, and an alignment from the cell's style", () => {
    const html = '<table><tr><td style="text-align: right">OS</td><td>File</td></tr><tr><td>macOS</td><td>dmg</td></tr></table>';

    expect(releaseNotesFromHtml(html)).toEqual([
      { kind: 'table', align: ['right', null], header: [[text('OS')], [text('File')]], rows: [[[text('macOS')], [text('dmg')]]] },
    ]);
  });

  it('reads a collapsed section as its text', () => {
    expect(releaseNotesFromHtml('<details><summary>More</summary><p>Hidden</p></details>')).toEqual([
      { kind: 'paragraph', children: [text('More')] },
      { kind: 'paragraph', children: [text('Hidden')] },
    ]);
  });

  it('reads a picture as GitHub renders one: in a link to itself, with a style and its own attributes', () => {
    const html =
      '<p dir="auto"><a target="_blank" rel="noopener noreferrer" href="https://github.com/user-attachments/assets/0f3b"><img src="https://github.com/user-attachments/assets/0f3b" alt="Settings › Tools" style="max-width: 100%;" data-canonical-src="https://example.com/x.png"></a></p>';

    expect(releaseNotesFromHtml(html)).toEqual([
      { kind: 'paragraph', children: [{ kind: 'image', url: 'https://github.com/user-attachments/assets/0f3b', alt: 'Settings › Tools' }] },
    ]);
  });

  it('keeps the link around a picture when the link has text too, and a picture without a description', () => {
    const html = "<p><a href='https://example.com/page'>See <img src='https://example.com/a.png'></a></p>";

    expect(releaseNotesFromHtml(html)).toEqual([
      {
        kind: 'paragraph',
        children: [{ kind: 'link', url: 'https://example.com/page', children: [text('See '), { kind: 'image', url: 'https://example.com/a.png', alt: '' }] }],
      },
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

  it('leaves out pictures from anywhere but the web', () => {
    const html = '<p>A <img src="x.png"> <img src="data:image/png;base64,AAAA"> <img src="file:///etc/a.png"> <IMG SRC="javascript:alert(1)"> <img alt="none">picture</p>';

    expect(releaseNotesFromHtml(html)).toEqual([{ kind: 'paragraph', children: [text('A picture')] }]);
  });

  it('reads a link to anywhere but the web around a picture as the picture alone', () => {
    const html = '<p><a href="javascript:alert(1)"><img src="https://example.com/a.png" alt="A"></a></p>';

    expect(releaseNotesFromHtml(html)).toEqual([{ kind: 'paragraph', children: [{ kind: 'image', url: 'https://example.com/a.png', alt: 'A' }] }]);
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

describe('the outline of release notes', () => {
  it('cuts the notes at their groups and notes, keeping smaller headings, pictures and tables inside a note', () => {
    const html = [
      '<p dir="auto">Before any group</p>',
      '<h2 dir="auto">New</h2>',
      '<h3 dir="auto">Run your own tools</h3>',
      '<p dir="auto">In <strong>Settings › Tools</strong>.</p>',
      '<h4 dir="auto">Placeholders</h4>',
      '<p dir="auto"><a target="_blank" rel="noopener noreferrer" href="https://github.com/user-attachments/assets/1"><img src="https://github.com/user-attachments/assets/1" alt="Tools" style="max-width: 100%;"></a></p>',
      '<markdown-accessiblity-table><table role="table"><thead><tr><th>Name</th></tr></thead><tbody><tr><td>{path}</td></tr></tbody></table></markdown-accessiblity-table>',
      '<h5 dir="auto">Smaller</h5>',
      '<h2 dir="auto">Fixed</h2>',
    ].join('\n');

    expect(releaseNotesOutline(html)).toEqual([
      { heading: null, blocks: [{ kind: 'paragraph', children: [text('Before any group')] }] },
      { heading: { level: 2, children: [text('New')] }, blocks: [] },
      {
        heading: { level: 3, children: [text('Run your own tools')] },
        blocks: [
          { kind: 'paragraph', children: [text('In '), { kind: 'strong', children: [text('Settings › Tools')] }, text('.')] },
          { kind: 'heading', level: 3, children: [text('Placeholders')] },
          { kind: 'paragraph', children: [{ kind: 'image', url: 'https://github.com/user-attachments/assets/1', alt: 'Tools' }] },
          { kind: 'table', align: [null], header: [[text('Name')]], rows: [[[text('{path}')]]] },
          { kind: 'heading', level: 3, children: [text('Smaller')] },
        ],
      },
      { heading: { level: 2, children: [text('Fixed')] }, blocks: [] },
    ]);
  });

  it("reads a heading in the box GitHub's pages put it in, with its anchor", () => {
    const html =
      '<div class="markdown-heading" dir="auto"><h2 tabindex="-1" class="heading-element" dir="auto">Fixed</h2><a id="user-content-fixed" class="anchor" aria-label="Permalink: Fixed" href="#fixed"><svg class="octicon"><path d="M0"></path></svg></a></div>\n<p>Él</p>';

    expect(releaseNotesOutline(html)).toEqual([{ heading: { level: 2, children: [text('Fixed')] }, blocks: [{ kind: 'paragraph', children: [text('Él')] }] }]);
  });

  it('keeps an h1, and an h4 in a box, inside the part they are in', () => {
    const html = '<h1>Title</h1><div class="markdown-heading"><h4>Small</h4></div>';

    expect(releaseNotesOutline(html)).toEqual([
      {
        heading: null,
        blocks: [
          { kind: 'heading', level: 1, children: [text('Title')] },
          { kind: 'heading', level: 3, children: [text('Small')] },
        ],
      },
    ]);
  });

  it('is empty for empty notes', () => {
    expect(releaseNotesOutline('')).toEqual([]);
    expect(releaseNotesOutline('\n \n')).toEqual([]);
  });
});
