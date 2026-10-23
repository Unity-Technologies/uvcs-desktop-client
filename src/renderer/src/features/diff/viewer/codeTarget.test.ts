import { describe, expect, it } from 'vitest';
import type { DiffSide } from './changeBlocks';
import {
  codeMenuState,
  codeMenuTarget,
  copiedPageText,
  fragmentSide,
  goToLineStart,
  hasCode,
  keyboardGoToLine,
  lineMenuOf,
  linesAtRightClick,
  linesOnSide,
  menuLinesOf,
  primarySelection,
  readOnlyFragment,
  selectedSideLines,
  textDiffSides,
  type FragmentSources,
  type OpenedCode,
} from './codeTarget';

const DIFF = { onlySide: null, typedInto: true };
const READ_ONLY_DIFF = { onlySide: null, typedInto: false };
const WHOLE_FILE = { onlySide: 'additions' as const, typedInto: true };

const TEXTS: Record<DiffSide, string> = { deletions: 'old one\r\nold two\r\n', additions: 'new one\nnew two\nnew three\n' };
const SOURCES: FragmentSources = { of: (side) => ({ fileName: 'src/a.ts', side: fragmentSide(side, null), text: TEXTS[side] }) };
const span = (line: number, start: number, endLine: number, end: number) => ({ start: { line, character: start }, end: { line: endLine, character: end } });

describe('codeMenuTarget', () => {
  it('is the side of the row right-clicked, with its line', () => {
    expect(codeMenuTarget({ lineNumber: 7, lineType: 'context', pane: 'deletions' }, DIFF, true)).toEqual({ side: 'deletions', typedInto: false, line: 7 });
    expect(codeMenuTarget({ lineNumber: 9, lineType: 'change-addition', pane: 'additions' }, DIFF, true)).toEqual({ side: 'additions', typedInto: true, line: 9 });
  });

  it("tells a unified diff's removed lines by their type", () => {
    expect(codeMenuTarget({ lineNumber: 3, lineType: 'change-deletion', pane: null }, DIFF, true)).toEqual({ side: 'deletions', typedInto: false, line: 3 });
  });

  it('is typed into only on the side the editor holds', () => {
    expect(codeMenuTarget({ lineNumber: 9, lineType: 'context', pane: 'additions' }, READ_ONLY_DIFF, true).typedInto).toBe(false);
  });

  it("is read-only until Pierre has created the editor", () => {
    expect(codeMenuTarget({ lineNumber: 9, lineType: 'context', pane: 'additions' }, DIFF, false).typedInto).toBe(false);
  });

  it('is the newer side off any row, with no line', () => {
    expect(codeMenuTarget(null, DIFF, true)).toEqual({ side: 'additions', typedInto: true, line: null });
  });

  it("is the one side a file shown alone has, wherever it's clicked", () => {
    expect(codeMenuTarget({ lineNumber: 4, lineType: 'context', pane: null }, WHOLE_FILE, true)).toEqual({ side: 'additions', typedInto: true, line: 4 });
    expect(codeMenuTarget(null, { onlySide: 'deletions', typedInto: false }, true)).toEqual({ side: 'deletions', typedInto: false, line: null });
  });
});

describe('keyboardGoToLine', () => {
  it("goes to a line of the text typed into while the caret is in it, from the caret's line", () => {
    expect(keyboardGoToLine(DIFF, 12, { side: 'deletions', first: 2, last: 2 })).toEqual({ side: 'additions', typedInto: true, line: 12 });
  });

  it('goes to a line of the side whose lines are selected, from the first, else of the newer side, else of the one side shown', () => {
    expect(keyboardGoToLine(READ_ONLY_DIFF, null, { side: 'deletions', first: 2, last: 5 })).toEqual({ side: 'deletions', typedInto: false, line: 2 });
    expect(keyboardGoToLine(READ_ONLY_DIFF, null, null)).toEqual({ side: 'additions', typedInto: false, line: null });
    expect(keyboardGoToLine({ onlySide: 'deletions', typedInto: false }, null, null)).toEqual({ side: 'deletions', typedInto: false, line: null });
  });
});

describe('the lines selected', () => {
  it('are on one side, first to last however they were dragged', () => {
    expect(selectedSideLines({ start: 9, side: 'deletions', end: 4, endSide: 'deletions' })).toEqual({ side: 'deletions', first: 4, last: 9 });
    expect(selectedSideLines({ start: 3, end: 3 })).toEqual({ side: 'additions', first: 3, last: 3 });
    expect(linesOnSide({ side: 'old', first: 2, last: 3 })).toEqual({ side: 'deletions', first: 2, last: 3 });
  });

  it("are none across both sides of a unified diff, nor when there aren't any", () => {
    expect(selectedSideLines({ start: 3, side: 'deletions', end: 5, endSide: 'additions' })).toBeNull();
    expect(selectedSideLines(null)).toBeNull();
    expect(linesOnSide(null)).toBeNull();
  });
});

describe('a read-only selection', () => {
  it("copies the text selected from its side's own text, as it shows", () => {
    expect(copiedPageText({ text: 'ignored', place: { side: 'deletions', span: span(0, 4, 1, 3) } }, (side) => TEXTS[side])).toBe('one\nold');
  });

  it('copies text selected across both sides of a unified diff as the page has it', () => {
    expect(copiedPageText({ text: 'old two\nnew one', place: null }, (side) => TEXTS[side])).toBe('old two\nnew one');
  });

  it('is the text selected to compare, else the lines selected', () => {
    expect(readOnlyFragment({ page: { text: 'two', place: { side: 'additions', span: span(1, 4, 1, 7) } }, lines: { side: 'deletions', first: 1, last: 1 } }, SOURCES)).toEqual({
      fileName: 'src/a.ts',
      side: 'new',
      lines: { first: 2, last: 2 },
      text: 'two',
    });
    expect(readOnlyFragment({ page: null, lines: { side: 'deletions', first: 1, last: 2 } }, SOURCES)).toEqual({ fileName: 'src/a.ts', side: 'old', lines: { first: 1, last: 2 }, text: 'old one\nold two' });
  });

  it('has nothing to compare across both sides of a unified diff, nor with nothing selected', () => {
    expect(readOnlyFragment({ page: { text: 'old two\nnew one', place: null }, lines: null }, SOURCES)).toBeNull();
    expect(readOnlyFragment({ page: null, lines: null }, SOURCES)).toBeNull();
  });
});

describe('textDiffSides', () => {
  const both = { original: true, modified: true };
  const shape = { wholeFile: false, sides: both, editable: false, editorAttached: false };

  it('shows the newer side alone for the whole file and an added file, the older for a deleted one, none for two versions', () => {
    expect(textDiffSides({ ...shape, wholeFile: true }).onlySide).toBe('additions');
    expect(textDiffSides({ ...shape, sides: { original: false, modified: true } }).onlySide).toBe('additions');
    expect(textDiffSides({ ...shape, sides: { original: true, modified: false } }).onlySide).toBe('deletions');
    expect(textDiffSides(shape).onlySide).toBeNull();
  });

  it("is typed into once the editor is attached to a workspace file's diff, and always in the whole-file editor", () => {
    expect(textDiffSides({ ...shape, editable: true }).typedInto).toBe(false);
    expect(textDiffSides({ ...shape, editable: true, editorAttached: true }).typedInto).toBe(true);
    expect(textDiffSides({ ...shape, editable: true, wholeFile: true }).typedInto).toBe(true);
    expect(textDiffSides({ ...shape, editorAttached: true }).typedInto).toBe(false);
  });
});

const typedOn = (selections: OpenedCode['selections']): OpenedCode => ({ target: { side: 'additions', typedInto: true, line: 3 }, selections, readOnly: { page: null, lines: null } });
const readOnlyOn = (readOnly: OpenedCode['readOnly'], line: number | null = 7): OpenedCode => ({ target: { side: 'deletions', typedInto: false, line }, selections: [], readOnly });
const HISTORY = { canUndo: true, canRedo: false };

describe('primarySelection', () => {
  it("is the last selection holding text, as Pierre's own last selection is its primary", () => {
    expect(primarySelection([span(0, 0, 0, 2), span(1, 1, 1, 1), span(2, 0, 2, 4)])).toEqual(span(2, 0, 2, 4));
    expect(primarySelection([span(0, 0, 0, 2), span(1, 1, 1, 1)])).toEqual(span(0, 0, 0, 2));
    expect(primarySelection([span(1, 1, 1, 1)])).toBeNull();
  });
});

describe('hasCode', () => {
  it('is text selected in the editor, carets alone holding none', () => {
    expect(hasCode(typedOn([span(1, 0, 1, 3)]))).toBe(true);
    expect(hasCode(typedOn([span(1, 3, 1, 3)]))).toBe(false);
  });

  it('is text selected on one side, else lines picked, on a read-only side; none across both sides', () => {
    expect(hasCode(readOnlyOn({ page: { text: 'two', place: { side: 'deletions', span: span(1, 0, 1, 3) } }, lines: null }))).toBe(true);
    expect(hasCode(readOnlyOn({ page: { text: 'old\nnew', place: null }, lines: { side: 'deletions', first: 1, last: 1 } }))).toBe(false);
    expect(hasCode(readOnlyOn({ page: null, lines: { side: 'deletions', first: 1, last: 1 } }))).toBe(true);
    expect(hasCode(readOnlyOn({ page: null, lines: null }))).toBe(false);
  });
});

describe('codeMenuState', () => {
  it("offers the editor's history and every entry where the code is typed into", () => {
    expect(codeMenuState(typedOn([span(1, 3, 1, 3)]), HISTORY, false)).toEqual({ editable: true, selectedText: false, selectedCode: false, canUndo: true, canRedo: false, canSelectAll: true });
    expect(codeMenuState(typedOn([span(1, 0, 1, 3)]), HISTORY, false)).toMatchObject({ selectedText: true, selectedCode: true });
  });

  it("reads a side as read-only without the editor: its Copy needs text in the page, its Select all lines to pick", () => {
    expect(codeMenuState(typedOn([span(1, 0, 1, 3)]), null, false)).toMatchObject({ editable: false, canUndo: false });
    const lines = readOnlyOn({ page: null, lines: { side: 'deletions', first: 1, last: 1 } });
    expect(codeMenuState(lines, null, true)).toEqual({ editable: false, selectedText: false, selectedCode: true, canUndo: false, canRedo: false, canSelectAll: true });
    expect(codeMenuState(readOnlyOn({ page: { text: 'two', place: null }, lines: null }), null, false)).toMatchObject({ selectedText: true, canSelectAll: false });
  });
});

describe('goToLineStart', () => {
  it("starts from the caret's line where the code is typed into, else from the line right-clicked", () => {
    expect(goToLineStart(typedOn([span(0, 0, 0, 1), span(4, 2, 6, 1)]))).toBe(7);
    expect(goToLineStart(typedOn([]))).toBeNull();
    expect(goToLineStart(readOnlyOn({ page: null, lines: null }, 7))).toBe(7);
    expect(goToLineStart(readOnlyOn({ page: null, lines: null }, null))).toBeNull();
  });
});

describe('the lines in the menu', () => {
  const select = () => {};

  it('are those a place selects for links, none where it picks lines its own way', () => {
    expect(menuLinesOf({ selectedLines: null, range: null, select })).toEqual({ range: null, select });
    expect(menuLinesOf({ selectedLines: undefined, range: null, select })).toBeUndefined();
  });

  it("join the lines' own entries where the place selects lines", () => {
    const menu = { enabled: true, pickLines: () => null, lineEntries: () => [] };
    expect(lineMenuOf(menu)).toEqual({ pickLines: menu.pickLines, lineEntries: menu.lineEntries });
    expect(lineMenuOf({ ...menu, enabled: false })).toBeUndefined();
  });

  it('are those the right-click picked, where the place picks them, else those already selected', () => {
    expect(linesAtRightClick({ side: 'new', first: 4, last: 4 }, { start: 9, end: 9 })).toEqual({ side: 'additions', first: 4, last: 4 });
    expect(linesAtRightClick(null, { start: 9, end: 9 })).toBeNull();
    expect(linesAtRightClick(undefined, { start: 9, side: 'deletions', end: 9 })).toEqual({ side: 'deletions', first: 9, last: 9 });
  });
});

describe('fragmentSide', () => {
  it("names a diff's sides as versions, and no version for a file shown alone", () => {
    expect(fragmentSide('deletions', null)).toBe('old');
    expect(fragmentSide('additions', null)).toBe('new');
    expect(fragmentSide('additions', 'additions')).toBeNull();
  });
});
