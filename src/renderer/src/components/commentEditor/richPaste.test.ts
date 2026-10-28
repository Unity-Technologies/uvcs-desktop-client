import { describe, expect, it } from 'vitest';
import { editorState, written } from './commentEditorTesting';
import { markdownFromClipboard, pasteMarkdown } from './richPaste';

describe('markdownFromClipboard', () => {
  it('keeps a web page’s bold, links and lists as Markdown', () => {
    const html = '<meta charset="utf-8"><p>Read <strong>this</strong> and <a href="https://example.com/docs">the docs</a>:</p><ul><li>one</li><li>two</li></ul>';
    expect(markdownFromClipboard(html, 'Read this and the docs:\none\ntwo')).toBe('Read **this** and [the docs](https://example.com/docs):\n\n- one\n- two');
  });

  it('reads Slack’s copy: its marks, code and line breaks', () => {
    const html = '<b>Heads up</b>: run <code>cm update</code> first<br><i>then</i> merge';
    expect(markdownFromClipboard(html, 'Heads up: run cm update first\nthen merge')).toBe('**Heads up**: run `cm update` first\n*then* merge');
  });

  it('reads Google Docs’ styles, unwrapping the bold-looking wrapper it puts around every copy', () => {
    const html =
      '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1a2b3c"><p dir="ltr"><span style="font-weight:700;">Bold</span><span style="font-weight:400;"> and </span><span style="font-style:italic;">italic</span><span> and </span><span style="text-decoration:line-through;">gone</span></p></b>';
    expect(markdownFromClipboard(html, 'Bold and italic and gone')).toBe('**Bold** and *italic* and ~~gone~~');
  });

  it('writes code copied from an editor as a code block, in the language the editor says', () => {
    const html = '<div style="color: #cccccc;font-family: Menlo, Monaco, monospace;white-space: pre;"><div><span>let</span> a = 1;</div><div>let b = 2;</div></div>';
    expect(markdownFromClipboard(html, 'let a = 1;\nlet b = 2;\n', 'typescript')).toBe('```typescript\nlet a = 1;\nlet b = 2;\n```');
    expect(markdownFromClipboard(html, 'let a = 1;\r\nlet b = 2;')).toBe('```\nlet a = 1;\nlet b = 2;\n```');
  });

  it('fences code holding backticks with more of them', () => {
    const html = '<pre style="white-space: pre; font-family: Consolas">x</pre>';
    expect(markdownFromClipboard(html, 'a ``` b\nc')).toBe('````\na ``` b\nc\n````');
  });

  it('pastes a copy with nothing rich in it as its plain text', () => {
    expect(markdownFromClipboard('<span>Just words, with file_name and 1. odd</span>', 'Just words, with file_name and 1. odd')).toBeNull();
    expect(markdownFromClipboard('', 'plain')).toBeNull();
  });

  it('gives a chip copied from a shown comment back as written', () => {
    const html = '<p>Fixes <a data-source="cs:4207" href="#"><span>4207</span><span>Fix the switch</span></a> <strong>now</strong></p>';
    expect(markdownFromClipboard(html, 'Fixes 4207 Fix the switch now')).toBe('Fixes cs:4207 **now**');
  });

  it('keeps images from the web only', () => {
    const html = '<p><strong>Look</strong> <img src="data:image/png;base64,AAAA" alt="pasted"><img src="https://example.com/a.png" alt="icon"></p>';
    expect(markdownFromClipboard(html, 'Look')).toBe('**Look** ![icon](https://example.com/a.png)');
  });

  it('keeps a table as a table', () => {
    const html = '<table><tr><th>Name</th><th>Size</th></tr><tr><td>a.png</td><td>2 MB</td></tr></table>';
    expect(markdownFromClipboard(html, 'Name\tSize\na.png\t2 MB')).toBe('| Name  | Size |\n| ----- | ---- |\n| a.png | 2 MB |');
  });
});

describe('pasteMarkdown', () => {
  const paste = (text: string, markdown: string) => {
    const state = editorState(text);
    return written(state.update(pasteMarkdown(state, markdown)).state);
  };

  it('pastes inline Markdown where the caret is', () => {
    expect(paste('See ‸ now', '**this**')).toBe('See **this**‸ now');
  });

  it('starts a block on a line of its own, what follows going on the next', () => {
    expect(paste('Look: ‸then', '```\ncode\n```')).toBe('Look: \n```\ncode\n```‸\nthen');
    expect(paste('‸', '- one\n- two')).toBe('- one\n- two‸');
  });

  it('replaces the selection', () => {
    expect(paste('«old»', '*new*')).toBe('*new*‸');
  });
});
