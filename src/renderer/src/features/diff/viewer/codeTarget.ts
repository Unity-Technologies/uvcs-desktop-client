import type { FocusedLines } from '../../../app/navigation/pages';
import type { GroupedEntry } from '../../../lib/menuGroups';
import type { DiffSide } from './changeBlocks';
import type { CodeMenuState } from './codeMenu';
import { holdsText } from './editorTextEdits';
import { lineUnderPointer, type RowUnderPointer } from './lineActions';
import type { LineRange } from './lineSelection';
import type { PageTextSelection } from './pierreDom';
import { fragmentOfLines, fragmentOfSpan, type CodeFragment } from './clipboardComparison';
import type { DiffSides } from './shownDiff';
import { isEmptySpan, spanText, type TextSpan } from './textSpans';

/** How a place shows code: one text (the whole-file editor, a merge) or a diff's two sides. */
export interface CodeLayoutSides {
  /** The one side shown alone (an added or deleted file's, a whole file's); null for a diff of two. */
  onlySide: DiffSide | null;
  /** The newer side is typed into, its editor attached. */
  typedInto: boolean;
}

/** How a text diff (`TextDiff`) shows its code, as its menu reads it. */
export interface TextDiffShape {
  /** The newer side typed into whole, without a diff. */
  wholeFile: boolean;
  /** Which sides are real versions: an added file shows its newer side alone, a deleted one its older. */
  sides: DiffSides;
  /** The newer side is a workspace file, typed into. */
  editable: boolean;
  /** Pierre's editor is attached to the diff (`attachesEditor`); the whole-file editor always has it. */
  editorAttached: boolean;
}

/** The one side a text diff shows alone (the whole file, an added file's newer side, a deleted file's older), and whether its newer side is typed into now. */
export function textDiffSides({ wholeFile, sides, editable, editorAttached }: TextDiffShape): CodeLayoutSides {
  const onlySide = wholeFile || !sides.original ? 'additions' : sides.modified ? null : 'deletions';
  return { onlySide, typedInto: editable && (editorAttached || wholeFile) };
}

/** The code a right-click (or ⌃G) is on: its side, whether it's typed into, and the line, when on one. */
export interface CodeTarget {
  side: DiffSide;
  typedInto: boolean;
  /** One-based, of the side; null off any line. */
  line: number | null;
}

/**
 * The code right-clicked: the side of the row under the pointer, the newer one off rows (below the last line); typed
 * into once Pierre has created the editor (`hasEditor`), else it's read as read-only text.
 */
export function codeMenuTarget(row: RowUnderPointer | null, { onlySide, typedInto }: CodeLayoutSides, hasEditor: boolean): CodeTarget {
  const clicked = row && lineUnderPointer(row);
  const side = onlySide ?? clicked?.side ?? 'additions';
  return { side, typedInto: typedInto && hasEditor && side === 'additions', line: clicked && clicked.side === side ? clicked.lineNumber : null };
}

/** What the code's menu opened on, read as it opened: the menu acts on that even after focus moved into it. */
export interface OpenedCode {
  target: CodeTarget;
  /** The editor's selections, zero-based, where the code right-clicked is typed into; none elsewhere. */
  selections: TextSpan[];
  /** What a read-only side has selected. */
  readOnly: ReadOnlySelection;
}

/** The selection holding text the editor treats as its own (its last, as Pierre's search panel does); none for carets alone. */
export function primarySelection(selections: readonly TextSpan[]): TextSpan | null {
  return selections.findLast((span) => !isEmptySpan(span)) ?? null;
}

/**
 * Whether there is code to compare with the clipboard: text selected in the editor; on a read-only side, text selected
 * on one side or lines picked by their numbers. Asked as the menu opens, without reading the text (`readOnlyFragment`
 * and `fragmentOfSpan` read it once the entry is chosen).
 */
export function hasCode({ target, selections, readOnly: { page, lines } }: OpenedCode): boolean {
  if (target.typedInto) return primarySelection(selections) !== null;
  return page ? page.place !== null : lines !== null;
}

/** The editor's history, where the code right-clicked is typed into. */
export interface EditorHistory {
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * What the menu shows for the code it opened on (`codeMenu`): typed into, the editor's history and every entry; a
 * read-only side's Copy needs text selected in the page, and its Select all lines that can be picked by their numbers.
 */
export function codeMenuState(opened: OpenedCode, history: EditorHistory | null, linesSelectable: boolean): CodeMenuState {
  const typed = opened.target.typedInto && history !== null;
  return {
    editable: typed,
    selectedText: typed ? holdsText(opened.selections) : opened.readOnly.page !== null,
    selectedCode: hasCode(opened),
    canUndo: typed && history.canUndo,
    canRedo: typed && history.canRedo,
    canSelectAll: typed || linesSelectable,
  };
}

/** The line Go to line… starts from: the caret's (Pierre's last selection's end) where it's typed into, else the line right-clicked. */
export function goToLineStart({ target, selections }: OpenedCode): number | null {
  if (!target.typedInto) return target.line;
  const caret = selections.at(-1);
  return caret ? caret.end.line + 1 : null;
}

/** The lines a place selects for links, for the code's menu to act on; none where it picks lines its own way (a workspace file's discards). */
export function menuLinesOf<Select>(lineLinks: { selectedLines: LineRange | null | undefined; range: LineRange | null; select: Select }): { range: LineRange | null; select: Select } | undefined {
  return lineLinks.selectedLines === undefined ? undefined : { range: lineLinks.range, select: lineLinks.select };
}

/** The lines' own menu (`useLineTools`), joining the code's where the place selects lines for links. */
export function lineMenuOf<Event>(menu: { enabled: boolean; pickLines: (event: Event) => FocusedLines | null; lineEntries: () => (GroupedEntry | false | undefined)[] }) {
  return menu.enabled ? { pickLines: menu.pickLines, lineEntries: menu.lineEntries } : undefined;
}

/**
 * Where ⌃G goes to a line: the text typed into while the caret is in it, from the caret's line; else the side whose
 * lines are selected, from the first of them; else the newer side (the one side there is, shown alone), from nothing.
 */
export function keyboardGoToLine({ onlySide, typedInto }: CodeLayoutSides, caretLine: number | null, selectedLines: SelectedSideLines | null): CodeTarget {
  if (caretLine !== null && typedInto && onlySide !== 'deletions') return { side: 'additions', typedInto: true, line: caretLine };
  const side = onlySide ?? selectedLines?.side ?? 'additions';
  return { side, typedInto: false, line: selectedLines?.side === side ? selectedLines.first : null };
}

/** Lines selected by their numbers on one side, one-based. */
export interface SelectedSideLines {
  side: DiffSide;
  first: number;
  last: number;
}

/**
 * The lines selected by their numbers (Pierre's range, `useLineLinks`), on one side; none across both sides of a unified
 * diff, which no one version's line numbers name.
 */
export function selectedSideLines(range: LineRange | null): SelectedSideLines | null {
  if (!range) return null;
  const side = range.side ?? 'additions';
  if ((range.endSide ?? side) !== side) return null;
  return { side, first: Math.min(range.start, range.end), last: Math.max(range.start, range.end) };
}

/** Lines as a link names them (the lines' menu picks them so: `useLineTools`), on their side. */
export function linesOnSide(lines: FocusedLines | null): SelectedSideLines | null {
  return lines && { side: lines.side === 'old' ? 'deletions' : 'additions', first: lines.first, last: lines.last };
}

/**
 * The lines a right-click's menu acts on: those the lines' menu just picked (`pickLines`, which selects the line
 * clicked before React shows it), where the place has that menu; else those already selected.
 */
export function linesAtRightClick(picked: FocusedLines | null | undefined, selected: LineRange | null): SelectedSideLines | null {
  return picked !== undefined ? linesOnSide(picked) : selectedSideLines(selected);
}

/** What a read-only side has selected: text in the page first (the user dragged over it), else lines by their numbers. */
export interface ReadOnlySelection {
  page: PageTextSelection | null;
  lines: SelectedSideLines | null;
}

/**
 * What Copy copies from a read-only side: the text selected, to the character, from the side's own text where its ends
 * are on one side's rows, else as the page has it (across the sides of a unified diff). Lines selected by their numbers
 * have their own "Copy lines".
 */
export function copiedPageText(page: PageTextSelection, textOf: (side: DiffSide) => string): string {
  return page.place ? spanText(textOf(page.place.side), page.place.span) : page.text;
}

/**
 * The code a read-only side's selection is, to compare: the text selected (on one side), else the lines selected;
 * none for text selected across both sides of a unified diff, which is no one version's code.
 */
export function readOnlyFragment({ page, lines }: ReadOnlySelection, sources: FragmentSources): CodeFragment | null {
  if (page) return page.place ? fragmentOfSpan(sources.of(page.place.side), page.place.span) : null;
  return lines && fragmentOfLines(sources.of(lines.side), { first: lines.first, last: lines.last });
}

/** Each side's text and how a fragment of it is named. */
export interface FragmentSources {
  of: (side: DiffSide) => { fileName: string; side: CodeFragment['side']; text: string };
}

/** Where a diff's side comes from, to name its code: the older or newer version, or the file alone. */
export function fragmentSide(side: DiffSide, onlySide: DiffSide | null): CodeFragment['side'] {
  if (onlySide) return null;
  return side === 'deletions' ? 'old' : 'new';
}
