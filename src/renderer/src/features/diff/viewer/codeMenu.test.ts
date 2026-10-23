import '../../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';
import { SEPARATOR, type Action, type MenuEntry } from '../../../lib/actions';
import { hotkey } from '../../../lib/shortcutRegistry';
import { codeMenu, type CodeMenuActions, type CodeMenuState } from './codeMenu';

const EDITABLE: CodeMenuState = { editable: true, selectedText: true, selectedCode: true, canUndo: true, canRedo: true, canSelectAll: true };
const READ_ONLY: CodeMenuState = { editable: false, selectedText: true, selectedCode: true, canUndo: false, canRedo: false, canSelectAll: true };

const actions = (): CodeMenuActions => ({
  undo: vi.fn(),
  redo: vi.fn(),
  cut: vi.fn(),
  copy: vi.fn(),
  paste: vi.fn(),
  delete: vi.fn(),
  selectAll: vi.fn(),
  goToLine: vi.fn(),
  find: vi.fn(),
  replace: vi.fn(),
  compareWithClipboard: vi.fn(),
});

/** The menu as it reads: its labels, with `—` for each separator. */
const reading = (menu: MenuEntry[]): string[] => menu.map((entry) => (entry === SEPARATOR ? '—' : (entry as Action).label));
const entry = (menu: MenuEntry[], label: string): Action => menu.find((each) => each !== SEPARATOR && (each as Action).label === label) as Action;

describe('codeMenu', () => {
  it("offers the editor's history, finding, a line, the clipboard, deleting and selecting where the text is typed into", () => {
    expect(reading(codeMenu(EDITABLE, actions()))).toEqual(['Undo', 'Redo', '—', 'Find', 'Replace', 'Go to line…', 'Compare with clipboard', '—', 'Cut', 'Copy', 'Paste', '—', 'Delete', 'Select all']);
  });

  it('offers only what reads the text where it is read-only: no history, Cut, Paste, Delete, nor Find and Replace, which only the editor has', () => {
    expect(reading(codeMenu(READ_ONLY, actions()))).toEqual(['Go to line…', 'Compare with clipboard', '—', 'Copy', '—', 'Select all']);
  });

  it("leaves Select all out of a read-only side whose lines can't be picked", () => {
    expect(reading(codeMenu({ ...READ_ONLY, canSelectAll: false }, actions()))).toEqual(['Go to line…', 'Compare with clipboard', '—', 'Copy']);
  });

  it('shows the keys each entry has in the text, from the registry', () => {
    const menu = codeMenu(EDITABLE, actions());
    expect(entry(menu, 'Undo').shortcut).toBe(hotkey('textUndo'));
    expect(entry(menu, 'Redo').shortcut).toBe(hotkey('textRedo'));
    expect(entry(menu, 'Replace').shortcut).toBe(hotkey('textReplace'));
    expect(entry(menu, 'Go to line…').shortcut).toBe(hotkey('goToLine'));
    expect(entry(menu, 'Delete').shortcut).toBeUndefined();
  });

  it('turns off what needs a selection while nothing is selected, saying why, and keeps Paste', () => {
    const menu = codeMenu({ ...EDITABLE, selectedText: false, selectedCode: false }, actions());
    for (const label of ['Delete', 'Compare with clipboard']) expect(entry(menu, label), label).toMatchObject({ disabled: true, disabledReason: 'Select some text first' });
    expect(entry(menu, 'Paste').disabled).toBeFalsy();
    expect(entry(menu, 'Select all').disabled).toBeFalsy();
  });

  it("keeps the editor's Cut and Copy on at a bare caret, which take its whole line as ⌘X and ⌘C do", () => {
    const menu = codeMenu({ ...EDITABLE, selectedText: false, selectedCode: false }, actions());
    expect(entry(menu, 'Cut').disabled).toBeFalsy();
    expect(entry(menu, 'Copy').disabled).toBeFalsy();
    expect(entry(codeMenu({ ...READ_ONLY, selectedText: false }, actions()), 'Copy')).toMatchObject({ disabled: true, disabledReason: 'Select some text first' });
  });

  it('compares lines picked by their numbers on a read-only side, leaving Copy to the text selected', () => {
    const menu = codeMenu({ ...READ_ONLY, selectedText: false, selectedCode: true }, actions());
    expect(entry(menu, 'Copy').disabled).toBe(true);
    expect(entry(menu, 'Compare with clipboard').disabled).toBe(false);
  });

  it('turns Undo and Redo off when there is nothing to undo or redo', () => {
    const menu = codeMenu({ ...EDITABLE, canUndo: false, canRedo: false }, actions());
    expect(entry(menu, 'Undo').disabled).toBe(true);
    expect(entry(menu, 'Redo').disabled).toBe(true);
  });

  it('compares what is selected with the clipboard, in its words alone, on read-only text too', () => {
    const run = actions();
    const menu = codeMenu(READ_ONLY, run);
    expect(entry(menu, 'Compare with clipboard')).toMatchObject({ disabled: false });
    expect(entry(menu, 'Compare with clipboard').detail).toBeUndefined();
    entry(menu, 'Compare with clipboard').run();
    expect(run.compareWithClipboard).toHaveBeenCalledOnce();
  });

  it('runs what each entry names', () => {
    const run = actions();
    const menu = codeMenu(EDITABLE, run);
    const runs: [string, keyof CodeMenuActions][] = [
      ['Undo', 'undo'],
      ['Redo', 'redo'],
      ['Find', 'find'],
      ['Replace', 'replace'],
      ['Go to line…', 'goToLine'],
      ['Compare with clipboard', 'compareWithClipboard'],
      ['Cut', 'cut'],
      ['Copy', 'copy'],
      ['Paste', 'paste'],
      ['Delete', 'delete'],
      ['Select all', 'selectAll'],
    ];
    for (const [label, action] of runs) {
      entry(menu, label).run();
      expect(run[action], label).toHaveBeenCalledOnce();
    }
  });
});
