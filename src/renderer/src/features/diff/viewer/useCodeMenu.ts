import type { Editor } from '@pierre/diffs/edit';
import { useRef, type KeyboardEvent, type MouseEvent, type RefObject } from 'react';
import type { FocusedLines } from '../../../app/navigation/pages';
import type { MenuEntry } from '../../../lib/actions';
import type { GroupedEntry } from '../../../lib/menuGroups';
import { matchesShortcut } from '../../../lib/shortcuts';
import { hotkey } from '../../../lib/shortcutRegistry';
import { prompt } from '../../../ui/dialog/prompt';
import { toast } from '../../../ui/toast/toastStore';
import type { DiffSide } from './changeBlocks';
import { clipboardComparison, clipboardText, fragmentOfSpan, type CodeFragment } from './clipboardComparison';
import { openCodeComparisonDialog } from './CodeComparisonDialog';
import { codeMenu, type CodeMenuActions } from './codeMenu';
import {
  codeMenuState,
  codeMenuTarget,
  copiedPageText,
  fragmentSide,
  goToLineStart,
  keyboardGoToLine,
  linesAtRightClick,
  primarySelection,
  readOnlyFragment,
  selectedSideLines,
  type CodeLayoutSides,
  type OpenedCode,
} from './codeTarget';
import { useDiffPreferences } from './diffPreferencesStore';
import { runEditorClipboard } from './editorClipboard';
import { deletionEdits } from './editorTextEdits';
import { goToLineError, goToLineQuestion, lineToGoTo } from './goToLine';
import type { LineRange } from './lineSelection';
import type { ScrollToLine } from './useLineLinks';
import { editorHasFocusIn, pageTextSelection, rowUnderPointer } from './pierreDom';
import { openPierreSearchPanel } from './pierreSearchPanel';
import { focusWithoutRing } from './usePointerFocusMark';
import { orderedSpan, shownLineCount, wholeTextSpan, type TextSpan } from './textSpans';

interface CodeMenuOptions {
  /** The scrolling element around the code. */
  containerRef: RefObject<HTMLElement | null>;
  /** Scrolls the code to a line, as the place lays its lines out (`scrollToLine` for a diff). */
  scrollTo: ScrollToLine;
  /** Names the code compared ("Player.cs, lines 4–9"). */
  fileName: string;
  /** Each side's text as shown, the newer side's as typed. */
  textOf: (side: DiffSide) => string;
  /** One text or two sides, and whether the newer side is typed into now. */
  sides: CodeLayoutSides;
  /** Pierre's editor of the text typed into, once it's created; none where nothing is typed into. */
  editor?: RefObject<Editor | null>;
  /** The lines selected by their numbers and how to select others, where the place selects lines (`menuLinesOf`). */
  lines?: { range: LineRange | null; select: (range: LineRange | null) => void };
  /** The lines' own menu, joining the code's where the place selects lines for links (`lineMenuOf`). */
  lineMenu?: { pickLines: (event: MouseEvent) => FocusedLines | null; lineEntries: () => (GroupedEntry | false | undefined)[] };
}

/**
 * The code's right-click menu (`codeMenu`) and Go to line's key (⌃G, Ctrl+G), on a diff or a text Pierre shows: every
 * choice comes from `codeTarget`, and this only wires it. The text typed into acts through Pierre's editor (its history
 * and edits; its own clipboard handlers, `runEditorClipboard`; its search panel, `openPierreSearchPanel`); read-only
 * text through the page's selection (`pageTextSelection`) and the lines selected by their numbers. The menu reads
 * what's selected as it opens, before focus moves into it.
 */
export function useCodeMenu({ containerRef, scrollTo, fileName, textOf, sides, editor, lines, lineMenu }: CodeMenuOptions) {
  const opened = useRef<OpenedCode | null>(null);
  const latest = useRef({ fileName, textOf, sides, lines, lineMenu, scrollTo });
  latest.current = { fileName, textOf, sides, lines, lineMenu, scrollTo };

  const editorNow = (): Editor | null => editor?.current ?? null;
  const editorSelections = (): TextSpan[] => (editorNow()?.getViewState().selections ?? []).map(orderedSpan);

  const onContextMenu = (event: MouseEvent): void => {
    const picked = latest.current.lineMenu?.pickLines(event);
    const host = containerRef.current?.querySelector('diffs-container');
    // Off the code (a chip or a label over it): no menu, not even the system's.
    if (!host || !event.nativeEvent.composedPath().includes(host)) return event.preventDefault();
    const target = codeMenuTarget(rowUnderPointer(event.nativeEvent.composedPath()), latest.current.sides, editorNow() !== null);
    opened.current = {
      target,
      selections: target.typedInto ? editorSelections() : [],
      readOnly: { page: target.typedInto ? null : pageTextSelection(containerRef.current), lines: linesAtRightClick(picked, latest.current.lines?.range ?? null) },
    };
  };

  /** The code selected, read once "Compare with clipboard" is chosen. */
  const fragmentOf = (on: OpenedCode): CodeFragment | null => {
    const { fileName, textOf, sides } = latest.current;
    const sourceOf = (side: DiffSide) => ({ fileName, side: fragmentSide(side, sides.onlySide), text: textOf(side) });
    if (!on.target.typedInto) return readOnlyFragment(on.readOnly, { of: sourceOf });
    const primary = primarySelection(on.selections);
    return primary && fragmentOfSpan({ ...sourceOf('additions'), text: editorNow()?.getText() ?? textOf('additions') }, primary);
  };

  const goToLine = async (side: DiffSide, typedInto: boolean, currentLine: number | null): Promise<void> => {
    const text = typedInto ? (editorNow()?.getText() ?? '') : latest.current.textOf(side);
    const lineCount = shownLineCount(text);
    const typed = await prompt({ ...goToLineQuestion(lineCount, currentLine), confirmLabel: 'Go', acceptInitialValue: true, validate: (value) => goToLineError(value, lineCount) });
    const line = typed === undefined ? null : lineToGoTo(typed, lineCount);
    const container = containerRef.current;
    const typedEditor = typedInto ? editorNow() : null;
    if (line === null || !container) return;
    // Scrolled to first: the place shows the line there (a diff unfolds the region holding it), for the caret to land
    // on a line on screen.
    latest.current.scrollTo(container, { side, lineNumber: line });
    // The scroll placed the line; the caret mustn't move it again to the view's edge.
    if (typedEditor) return typedEditor.focus({ lineNumber: line, character: 0, preventScroll: true });
    latest.current.lines?.select({ start: line, side, end: line, endSide: side });
    focusWithoutRing(container);
  };

  const compareWithClipboard = (selection: CodeFragment): void => {
    const nothingCopied = (): void => void toast.info('The clipboard holds no text', 'Copy the code to compare the selection with, then try again.');
    navigator.clipboard.readText().then((read) => {
      const clipboard = clipboardText(read);
      if (clipboard === null) return nothingCopied();
      openCodeComparisonDialog(clipboardComparison(clipboard, selection, useDiffPreferences.getState().comparisonMethod));
    }, nothingCopied);
  };

  const actionsFor = (on: OpenedCode): CodeMenuActions => {
    const { target, selections, readOnly } = on;
    const typed = target.typedInto ? editorNow() : null;
    const readOnlyLines = latest.current.lines;
    return {
      undo: () => {
        typed?.undo();
        typed?.focus();
      },
      redo: () => {
        typed?.redo();
        typed?.focus();
      },
      cut: () => typed && runEditorClipboard('cut', typed),
      copy: () => {
        if (typed) return runEditorClipboard('copy', typed);
        if (readOnly.page) void navigator.clipboard.writeText(copiedPageText(readOnly.page, latest.current.textOf));
      },
      paste: () => typed && runEditorClipboard('paste', typed),
      delete: () => {
        if (!typed) return;
        typed.applyEdits(deletionEdits(selections));
        typed.focus();
      },
      selectAll: () => {
        if (typed) {
          typed.setSelections([{ ...wholeTextSpan(typed.getText()), direction: 'forward' }]);
          return typed.focus();
        }
        const count = shownLineCount(latest.current.textOf(target.side));
        readOnlyLines?.select({ start: 1, side: target.side, end: count, endSide: target.side });
      },
      goToLine: () => void goToLine(target.side, target.typedInto, goToLineStart(on)),
      find: () => openSearchPanel('find'),
      replace: () => openSearchPanel('replace'),
      compareWithClipboard: () => {
        const selection = fragmentOf(on);
        if (selection) compareWithClipboard(selection);
      },
    };
    function openSearchPanel(mode: 'find' | 'replace'): void {
      typed?.focus();
      openPierreSearchPanel(containerRef.current, mode);
    }
  };

  /** The menu, with the lines' entries where the place has them. */
  const entries = (): MenuEntry[] => {
    const on = opened.current;
    if (!on) return [];
    const typed = on.target.typedInto ? editorNow() : null;
    const state = codeMenuState(on, typed && { canUndo: typed.canUndo, canRedo: typed.canRedo }, latest.current.lines !== undefined);
    return codeMenu(state, actionsFor(on), latest.current.lineMenu?.lineEntries() ?? []);
  };

  /** Go to line's key, from anywhere in the code: the text typed into (its search box too), else the side whose lines are selected. */
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || !matchesShortcut(event.nativeEvent, hotkey('goToLine'))) return;
    event.preventDefault();
    event.stopPropagation();
    const { sides, lines: lineLinks } = latest.current;
    const caret = editorHasFocusIn(containerRef.current) ? editorSelections().at(-1) : undefined;
    const target = keyboardGoToLine(sides, caret ? caret.end.line + 1 : null, selectedSideLines(lineLinks?.range ?? null));
    void goToLine(target.side, target.typedInto, target.line);
  };

  return { onContextMenu, entries, onKeyDown };
}
