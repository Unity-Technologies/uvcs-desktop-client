import { menuAction } from '../../../components/menuWords';
import type { MenuEntry } from '../../../lib/actions';
import { groupedMenu, type GroupedEntry } from '../../../lib/menuGroups';
import { hotkey } from '../../../lib/shortcutRegistry';

/** What the text right-clicked is and holds, as the menu opens. */
export interface CodeMenuState {
  /**
   * The text is typed into (Pierre's editor: a pending change's newer side, the whole-file editor, a merge's
   * hand-editing); else it's read-only (every other side), which offers nothing that changes it.
   */
  editable: boolean;
  /** Text is selected there: what Delete, and a read-only side's Copy, act on. */
  selectedText: boolean;
  /** Code to compare with the clipboard is selected there: text, or on a read-only side lines picked by their numbers. */
  selectedCode: boolean;
  /** The editor's history; read-only text has none. */
  canUndo: boolean;
  canRedo: boolean;
  /** Every line can be selected: the editor's text, or a side whose lines are picked by their numbers. */
  canSelectAll: boolean;
}

/** What the menu's entries do, on the text right-clicked. */
export interface CodeMenuActions {
  undo: () => void;
  redo: () => void;
  cut: () => void;
  copy: () => void;
  paste: () => void;
  delete: () => void;
  selectAll: () => void;
  goToLine: () => void;
  find: () => void;
  replace: () => void;
  compareWithClipboard: () => void;
}

const NOTHING_SELECTED = 'Select some text first';

/**
 * The right-click menu of code (a diff's sides, the whole-file editor, a merge's hand-editing), in the menus' one
 * grammar (`groupedMenu`): the editor's history; finding in the text, a line of it, and comparing what's selected with
 * the clipboard; the clipboard; deleting and selecting. Read-only text offers only what reads it. Find and Replace are
 * Pierre's search panel, which only the editor has. Typed into, Cut and Copy are the editor's own (`runEditorClipboard`),
 * which take a bare caret's whole line, as ⌘X and ⌘C do; read-only, Copy copies the text selected, and lines picked by
 * their numbers have their own "Copy lines" (`lineMenuEntries`), and are code to compare. Neither Paste nor "Compare with clipboard" waits
 * on the clipboard to show: reading it to find out would ask the OS for its content (an image, a huge text) at every
 * right-click, and the menu would open before the answer. Pasting nothing does nothing, and comparing with an empty
 * clipboard says so (`clipboardText`).
 */
export function codeMenuEntries(state: CodeMenuState, run: CodeMenuActions): (GroupedEntry | false | undefined)[] {
  const { editable, selectedText, selectedCode } = state;
  const needsText = { disabled: !selectedText, ...(!selectedText && { disabledReason: NOTHING_SELECTED }) };
  const needsCode = { disabled: !selectedCode, ...(!selectedCode && { disabledReason: NOTHING_SELECTED }) };
  return [
    editable && menuAction('undoEdit', run.undo, { shortcut: hotkey('textUndo'), disabled: !state.canUndo }),
    editable && menuAction('redoEdit', run.redo, { shortcut: hotkey('textRedo'), disabled: !state.canRedo }),
    editable && menuAction('find', run.find, { shortcut: hotkey('textFind') }),
    editable && menuAction('replace', run.replace, { shortcut: hotkey('textReplace') }),
    menuAction('goToLine', run.goToLine, { shortcut: hotkey('goToLine') }),
    menuAction('compareWithClipboard', run.compareWithClipboard, needsCode),
    editable && menuAction('cut', run.cut, { shortcut: hotkey('textCut') }),
    menuAction('copyText', run.copy, { shortcut: hotkey('textCopy'), ...(!editable && needsText) }),
    editable && menuAction('paste', run.paste, { shortcut: hotkey('textPaste') }),
    editable && menuAction('deleteText', run.delete, needsText),
    state.canSelectAll && menuAction('selectAll', run.selectAll, { shortcut: hotkey('textSelectAll') }),
  ];
}

/** The code's menu, with the entries of the lines right-clicked where the place has them (`lineMenuEntries`). */
export function codeMenu(state: CodeMenuState, run: CodeMenuActions, lineEntries: (GroupedEntry | false | undefined)[] = []): MenuEntry[] {
  return groupedMenu([...codeMenuEntries(state, run), ...lineEntries]);
}
