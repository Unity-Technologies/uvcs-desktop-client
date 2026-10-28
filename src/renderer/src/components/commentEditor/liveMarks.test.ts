import { describe, expect, it } from 'vitest';
import { editorState } from './commentEditorTesting';
import { liveMarksOf, type LiveMark } from './liveMarks';

const FOCUSED = { revealsSelection: true };

/** The marks as the text they cover: `hidden **`, `reference cs:12`, `line 0 quote`. */
function marksOf(written: string, options = FOCUSED): string[] {
  const state = editorState(written);
  return liveMarksOf(state, options).map((mark) => shown(mark, state.doc.toString()));
}

function shown(mark: LiveMark, text: string): string {
  if (mark.kind === 'line') return `line ${mark.at} ${mark.block}`;
  const covered = text.slice(mark.from, mark.to);
  switch (mark.kind) {
    case 'task':
      return `task ${covered} ${mark.checked ? 'checked' : 'unchecked'} at ${mark.box}`;
    case 'image':
      return `image ${mark.alt} ${mark.url}`;
    default:
      return `${mark.kind} ${covered}`;
  }
}

describe('liveMarksOf', () => {
  describe('formatting', () => {
    it('hides the marks of what the caret is not in, and shows them for the construct it is in', () => {
      expect(marksOf('Make it **bold** and _quick_ ‸')).toEqual(['hidden **', 'hidden **', 'hidden _', 'hidden _']);
      expect(marksOf('Make it **bo‸ld** and _quick_')).toEqual(['hidden _', 'hidden _']);
    });

    it("reveals a construct with the caret at its edge, as it's about to type there", () => {
      expect(marksOf('Make it **bold**‸ now')).toEqual([]);
    });

    it('draws a whole comment without the focus as it reads, wherever the caret was left', () => {
      expect(marksOf('Make it **bo‸ld**', { revealsSelection: false })).toEqual(['hidden **', 'hidden **']);
    });

    it('hides strikethrough, inline code and a heading’s marks the same way', () => {
      expect(marksOf('# Title\n~~old~~ `code`\n‸')).toEqual(['hidden # ', 'hidden ~~', 'hidden ~~', 'hidden `', 'hidden `']);
      expect(marksOf('# Ti‸tle')).toEqual([]);
    });

    it('keeps an underlined heading’s underline', () => {
      expect(marksOf('Title\n===\n\n‸')).toEqual([]);
    });

    it('reads a link as its text, its brackets and address showing only around the caret', () => {
      expect(marksOf('See [the docs](https://example.com) ‸')).toEqual(['hidden [', 'link the docs', 'hidden ]', 'hidden (', 'hidden https://example.com', 'hidden )']);
      expect(marksOf('See [the d‸ocs](https://example.com)')).toEqual(['link the docs']);
    });
  });

  describe('blocks', () => {
    it('draws a list’s marks as bullets, but where the caret is', () => {
      expect(marksOf('- one\n- two\n\n‸')).toEqual(['bullet -', 'bullet -']);
      expect(marksOf('- one\n‸- two')).toEqual(['bullet -']);
    });

    it('draws a task’s box as a checkbox in place of its bullet', () => {
      expect(marksOf('- [ ] write\n- [x] test\n\n‸')).toEqual(['task - [ ] unchecked at 2', 'task - [x] checked at 14']);
    });

    it('keeps the bullet of a task whose `- ` the caret is at', () => {
      expect(marksOf('‸- [ ] write')).toEqual(['task [ ] unchecked at 2']);
    });

    it('marks every line of a quote, hiding its `> ` away from the caret', () => {
      expect(marksOf('> one\n> two\n\n‸')).toEqual(['line 0 quote', 'hidden > ', 'line 6 quote', 'hidden > ']);
    });

    it("marks a code block's lines and dims its fences, reading nothing inside", () => {
      expect(marksOf('```ts\nlet cs = "cs:12";\n```\n‸')).toEqual(['line 0 codeFirst', 'fence ```', 'fence ts', 'line 6 code', 'line 24 codeLast', 'fence ```']);
    });

    it('draws an image from the web as a chip, and leaves any other as written', () => {
      expect(marksOf('![The new icon](https://example.com/icon.png) ‸')).toEqual(['image The new icon https://example.com/icon.png']);
      expect(marksOf('![Local](file:///icon.png) ‸')).toEqual([]);
    });

    it('leaves a table drawn whole to the table model, and reads it as text with the caret in it', () => {
      expect(marksOf('| a | cs:12 |\n| --- | --- |\n\n‸')).toEqual([]);
      expect(marksOf('| a | cs:1‸2 |\n| --- | --- |')).toEqual(['typedReference cs:12']);
    });
  });

  describe('references', () => {
    it('draws every reference as its chip', () => {
      expect(marksOf('Fixes cs:12 on br:/main/task for @ana :tada: ‸')).toEqual(['reference cs:12', 'reference br:/main/task', 'reference @ana', 'reference :tada:']);
    });

    it('keeps a chip whole with the caret at its edge: the caret steps over it', () => {
      expect(marksOf('Fixes cs:12‸ now')).toEqual(['reference cs:12']);
    });

    it('shows a selected reference as typed, so typing replaces it', () => {
      expect(marksOf('Fixes «cs:12» now')).toEqual(['typedReference cs:12']);
    });

    it('reads no reference in code, a link, an address or raw HTML, as the shown comment', () => {
      expect(marksOf('`cs:12` [cs:13](https://x.com) https://x.com/?b=br:/main <b>cs:14</b>\n‸')).toEqual([
        'hidden `',
        'hidden `',
        'hidden [',
        'link cs:13',
        'hidden ]',
        'hidden (',
        'hidden https://x.com',
        'hidden )',
      ]);
    });

    it('leaves a sentence’s punctuation out of a reference', () => {
      expect(marksOf('See cs:12. ‸')).toEqual(['reference cs:12']);
    });
  });

  it('reads only the ranges asked for (the editor’s visible ones)', () => {
    const state = editorState('cs:1\ncs:2\ncs:3');
    expect(liveMarksOf(state, { revealsSelection: false }, [{ from: 5, to: 9 }]).map((mark) => mark.kind === 'reference' && mark.source)).toEqual(['cs:2']);
  });
});
