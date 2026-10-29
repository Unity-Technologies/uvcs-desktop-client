import { describe, expect, it } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
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

    it('draws a key as its keycap, its tags showing only around the caret', () => {
      expect(marksOf('Press <kbd>Ctrl</kbd>+<kbd>F</kbd> ‸')).toEqual(['hidden <kbd>', 'key Ctrl', 'hidden </kbd>', 'hidden <kbd>', 'key F', 'hidden </kbd>']);
      expect(marksOf('Press <kbd>Ct‸rl</kbd>')).toEqual([]);
    });

    it('reads a link as its text, its brackets and address showing only around the caret', () => {
      expect(marksOf('See [the docs](https://example.com) ‸')).toEqual(['hidden [', 'link the docs', 'hidden ]', 'hidden (', 'hidden https://example.com', 'hidden )']);
      expect(marksOf('See [the d‸ocs](https://example.com)')).toEqual(['link the docs']);
      expect(marksOf('See [‸](url)')).toEqual([]);
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

    it('draws a task in a quote with its box alone, no bullet beside it', () => {
      expect(marksOf('> - [ ] write\n\n‸').filter((mark) => mark.startsWith('bullet') || mark.startsWith('task'))).toEqual(['task - [ ] unchecked at 4']);
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

    it('shows the chip the caret reaches as its text, to edit, as marks show around the caret; the others stay drawn', () => {
      expect(marksOf('Fixes cs:12‸ and cs:13')).toEqual(['typedReference cs:12', 'reference cs:13']);
      expect(marksOf('Fixes ‸cs:12 and cs:13')).toEqual(['typedReference cs:12', 'reference cs:13']);
      expect(marksOf('Fixes cs:1‸2')).toEqual(['typedReference cs:12']);
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

    it('reads a person or a repository named by what reads as an email address', () => {
      expect(marksOf('Thanks @ana@acme.com for cs:12@game@build.acme.com ‸')).toEqual(['reference @ana@acme.com', 'reference cs:12@game@build.acme.com']);
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

/** A state whose selection is `ranges`, each `[anchor, head]`: a drag upward has its head before its anchor. */
function withSelection(text: string, ...ranges: [anchor: number, head: number][]): EditorState {
  const state = editorState(text, EditorState.allowMultipleSelections.of(true));
  return state.update({ selection: EditorSelection.create(ranges.map(([anchor, head]) => EditorSelection.range(anchor, head))) }).state;
}

function marksWith(state: EditorState): string[] {
  return liveMarksOf(state, FOCUSED).map((mark) => shown(mark, state.doc.toString()));
}

const WIDGETS = new Set<LiveMark['kind']>(['reference', 'image', 'task', 'bullet']);

describe('liveMarksOf, with a selection', () => {
  // `cs:12` is 5–10, `**now**` 11–18.
  const SHIP = 'Ship cs:12 **now** end';

  it('keeps what it covers drawn, as the press that started it showed it, so nothing moves under the pointer', () => {
    expect(marksWith(withSelection(SHIP, [SHIP.length, 0]))).toEqual(['reference cs:12', 'selected cs:12', 'hidden **', 'hidden **']);
  });

  it('draws every construct a drag covers, the widgets marked as selected', () => {
    const text = 'An ![robot](https://x.y/r.png) :green_heart: <kbd>Ctrl</kbd> `code` [docs](https://x.y) cs:12\n\n- [ ] Ship\n- item\n\nend';
    const marks = marksWith(withSelection(text, [text.length, 0]));
    expect(marks.filter((mark) => !mark.startsWith('selected'))).toEqual(marksOf(text, { revealsSelection: false }));
    const widgets = liveMarksOf(editorState(text), { revealsSelection: false }).filter((mark) => WIDGETS.has(mark.kind));
    expect(widgets).toHaveLength(5);
    expect(marks.filter((mark) => mark.startsWith('selected'))).toEqual(widgets.map((mark) => (mark.kind === 'line' ? '' : `selected ${text.slice(mark.from, mark.to)}`)));
  });

  it('draws a chip it ends inside of, marked as selected', () => {
    expect(marksWith(withSelection(SHIP, [SHIP.length, 7]))).toEqual(['reference cs:12', 'selected cs:12', 'hidden **', 'hidden **']);
  });

  it('leaves a chip it only reaches the edge of unselected', () => {
    expect(marksWith(withSelection(SHIP, [SHIP.length, 10]))).toEqual(['reference cs:12', 'hidden **', 'hidden **']);
  });

  it('keeps revealed the construct it started in (Shift+→ inside **now**), as the caret showed it before it grew', () => {
    expect(marksWith(withSelection(SHIP, [14, 16]))).toEqual(['reference cs:12']);
  });

  it('reveals around each caret of several, a range among them revealing only where it started', () => {
    const text = 'Make **bold** and _quick_ end';
    expect(marksWith(withSelection(text, [21, 21], [16, 0]))).toEqual(['hidden **', 'hidden **']);
  });
});
