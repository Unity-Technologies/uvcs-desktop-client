/**
 * Expand Diff: a diff given the whole window to read in, the sidebar, the files beside it, its page's header and the
 * status bar out of sight (docs/features/diff.md "Expanding the diff"). An in-app layout, never the OS's full screen
 * (View ▸ Enter Full Screen), which stacks with it independently. What decides when it starts, lasts and ends is here;
 * `diffExpansionStore` holds it for the window.
 */
import type { ShortcutId } from '../lib/shortcutRegistry';

/** Where the window's navigation stands: the view, and how many pages are open over it. */
export interface NavigationSpot {
  view: string;
  depth: number;
}

/**
 * Whether a navigation leaves the diff that was expanded: another view, a page opened over it or gone back from. A page
 * replaced at the same depth (a page window following the selection to another changeset) keeps it, as choosing
 * another file of the diff does: the window still shows a diff where the expanded one was.
 */
export function leavesExpandedDiff(before: NavigationSpot, after: NavigationSpot): boolean {
  return before.view !== after.view || before.depth !== after.depth;
}

/** A diff that can expand, on screen: the element its header's Expand button was drawn in. */
export interface ExpandableDiff<Element = HTMLElement> {
  element: Element;
}

/** Whether a diff that can expand is in front: a view stays mounted, hidden, under the pages opened over it. */
export function expandableDiffInFront<Element>(diffs: Iterable<ExpandableDiff<Element>>, inFront: (element: Element) => boolean): boolean {
  return [...diffs].some((diff) => inFront(diff.element));
}

/** What held the keyboard as the diff expanded or collapsed. */
export interface FocusHolder {
  /** Nothing: the page itself. */
  onBody: boolean;
  /** It still shows: it wasn't in a part the diff stowed. */
  visible: boolean;
  /** A button: the diff header's Expand button or change arrows, clicked with the mouse or reached with Tab. */
  onButton: boolean;
}

/**
 * Whether the keyboard goes to the expanded diff: from nowhere, from a list that went out of sight, or from a button
 * (the Expand button, a change arrow clicked before), so the arrows scroll the code and Esc reaches the diff first (a
 * picked change drops before the diff collapses). What still shows and holds it otherwise (a field) keeps it.
 */
export function focusGoesToDiff(holder: FocusHolder): boolean {
  return holder.onBody || !holder.visible || holder.onButton;
}

/** How the user asked to expand or collapse: a key (Esc, the shortcut, the palette, the menu, Enter on the button) or a click. */
export type AskedBy = 'keyboard' | 'pointer';

/** How the Expand button was pressed, from its click's `detail` (the pointer's presses): 0 for Enter or Space. */
export function askedBy(clickDetail: number): AskedBy {
  return clickDetail === 0 ? 'keyboard' : 'pointer';
}

/**
 * Whether the keyboard goes to the diff's code as the user collapses it from the keyboard: from nowhere (a step to
 * another file left it on the page) or a button, whose focus ring the key just pressed would show; never back to the
 * list it had before expanding. What still shows and takes keys (the code, a field) keeps it, so ⌥↓ and the arrows
 * work at once. A click on the Expand button leaves it there, ringless.
 */
export function focusGoesToDiffOnCollapse(holder: FocusHolder, by: AskedBy): boolean {
  return by === 'keyboard' && focusGoesToDiff(holder);
}

/** Whether Expand Diff's command is offered (the palette's entry): to collapse, or with a diff in front to expand. */
export function expandDiffOffered(expanded: boolean, diffInFront: boolean): boolean {
  return expanded || diffInFront;
}

/** What Expand Diff's command does: collapses an expanded diff, else expands the one in front, if any. */
export function expandedAfterToggle(expanded: boolean, diffInFront: boolean): boolean {
  return expanded ? false : diffInFront;
}

/** How an Esc press reaches the window, after everything under it had its turn. */
export interface EscapePress {
  /** Whether the key is Esc (`collapseDiff`). */
  isEscape: boolean;
  /** Something took it first: a menu or popover closing, the picked lines dropped, the editor leaving the text. */
  defaultPrevented: boolean;
  /** A field typed into, a dialog, the palette or a menu holds the keyboard (`isKeyboardTaken`). */
  keyboardTaken: boolean;
  /** A held key repeats, or a modal dialog is open (`windowShortcutMayRun`). */
  mayRun: boolean;
  /** A command bound to Esc is on (Files' "Cancel the cut"): it runs instead, whichever window listener hears it first. */
  commandClaims: boolean;
}

/** Whether Esc collapses the expanded diff: only once nothing else claimed it, one thing per press. */
export function escapeCollapsesDiff(expanded: boolean, press: EscapePress): boolean {
  return expanded && press.isEscape && !press.defaultPrevented && !press.keyboardTaken && press.mayRun && !press.commandClaims;
}

/**
 * Whether Esc in a diff beside a list takes the keyboard back to the list (History's `historyLeavePane`, Files'
 * `leaveFileViewer`). Not while the diff is expanded: the list is out of sight, and Esc collapses the diff instead.
 */
export function escapeBackToList(expanded: boolean, press: Pick<EscapePress, 'isEscape' | 'defaultPrevented' | 'keyboardTaken'>): boolean {
  return !expanded && press.isEscape && !press.defaultPrevented && !press.keyboardTaken;
}

/** What a stowed part's window shortcut does while the diff is expanded (`shortcutWhileExpanded`). */
export type ShortcutWhileExpanded = 'acts' | 'collapseFirst' | 'collapseOnly' | 'off';

const WHILE_EXPANDED: Partial<Record<ShortcutId, ShortcutWhileExpanded>> = {
  // Never out of sight: the summary and what is checked in show, and an empty summary takes the caret.
  checkin: 'collapseFirst',
  // The sidebar the user asked for comes back as it was (folded or not); folding it too would undo the ask.
  toggleSidebar: 'collapseOnly',
  // Incoming's update bar is out of sight: Esc collapses the diff, and never stops a resolve run unseen.
  stopResolvingInTool: 'off',
  // Go to file (`filesGoToFile`, `goToFile`) acts: the file picked shows in the diff, as choosing another file does.
};

/**
 * What a window shortcut of a part the expanded diff stows does while it is: `acts` as ever, `collapseFirst` gives the
 * window back then acts on what is in sight again, `collapseOnly` gives it back and stops there, `off` doesn't take the
 * key at all (it goes on to what is in sight: Esc collapses the diff).
 */
export function shortcutWhileExpanded(id: ShortcutId): ShortcutWhileExpanded {
  return WHILE_EXPANDED[id] ?? 'acts';
}

/** What a view knows of the diffs it can show: still reading them, some, or none at all once read. */
export type HostDiffs = 'reading' | 'some' | 'none';

/**
 * Whether the expanded diff ends with a view's settled state: nothing to diff left (nothing pending after an undo,
 * Incoming up to date), the window would show an empty page with nothing to go to. A read (the next changeset of a
 * branch, a page window following the selection) keeps it, and so does a view hidden under a page, which empties while
 * the page's expanded diff is in front (`diffInFront`): only a view in front, whose diff went with its files, ends it.
 */
export function collapsesWithHost(expanded: boolean, diffs: HostDiffs, diffInFront: boolean): boolean {
  return expanded && diffs === 'none' && !diffInFront;
}

/** What a tree whose details show the selected item has selected. */
export interface TreeSelection {
  /** Its root was read. */
  read: boolean;
  /** Something is selected. */
  selected: boolean;
  /** The selected row's item type; none while it isn't among the rows yet (revealed by Go to file, its folder opening). */
  itemType: string | undefined;
}

/**
 * The diffs of a view whose details show the selected file's (Files, Browse repository): none once no file is selected
 * (deleted, or the selection cleared by a refresh), or a folder is; a selection not among the rows yet is still read.
 */
export function selectedFileDiffs({ read, selected, itemType }: TreeSelection): HostDiffs {
  if (!read) return 'reading';
  if (!selected) return 'none';
  if (itemType === undefined) return 'reading';
  return itemType === 'directory' ? 'none' : 'some';
}

/** The diffs of a view listing what it diffs (History's revisions): none once its filters or a refresh leave no row. */
export function listedDiffs(read: boolean, shownCount: number): HostDiffs {
  if (!read) return 'reading';
  return shownCount > 0 ? 'some' : 'none';
}

/** Whether a details panel shows only its file's diff (`DetailsPanel`'s `changesOnly`): a file's, while expanded. */
export function showsDiffOnly(expanded: boolean, isFile: boolean): boolean {
  return expanded && isFile;
}

/** The words of the diff header's button and the palette's command, by whether the diff is expanded. */
export interface ExpandDiffWords {
  label: string;
  /** What the button's tooltip says under the label: how to leave, before expanding. */
  hint?: string;
}

/** `escapeKeys` is how Esc reads on this OS (`formatShortcut`): the hint says how to leave before the mode starts. */
export function expandDiffWords(expanded: boolean, escapeKeys: string): ExpandDiffWords {
  return expanded ? { label: 'Collapse diff' } : { label: EXPAND_DIFF_NAME, hint: `${escapeKeys} to collapse` };
}

/** The button's accessible name, the same pressed or not: a toggle tells its state with `aria-pressed`. */
export const EXPAND_DIFF_NAME = 'Expand diff';
