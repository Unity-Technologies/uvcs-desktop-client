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

/**
 * What a window shortcut of a part the expanded diff stowed does while it is: `acts` as ever, `collapseFirst` gives
 * the window back then acts on what is in sight again, `collapseOnly` gives it back and stops there.
 */
export type ShortcutWhileExpanded = 'acts' | 'collapseFirst' | 'collapseOnly';

const WHILE_EXPANDED: Partial<Record<ShortcutId, ShortcutWhileExpanded>> = {
  // Never out of sight: the summary and what is checked in show, and an empty summary takes the caret.
  checkin: 'collapseFirst',
  // The sidebar the user asked for comes back as it was (folded or not); folding it too would undo the ask.
  toggleSidebar: 'collapseOnly',
  // Go to file (`filesGoToFile`, `goToFile`) acts: the file picked shows in the diff, as choosing another file does.
};

export function shortcutWhileExpanded(id: ShortcutId): ShortcutWhileExpanded {
  return WHILE_EXPANDED[id] ?? 'acts';
}

/** What a view knows of the diffs it can show: still reading them, some, or none at all once read. */
export type HostDiffs = 'reading' | 'some' | 'none';

/**
 * Whether the expanded diff ends with its view's settled state: nothing to diff left (nothing pending after a check-in,
 * Incoming up to date), the window would show an empty page with nothing to go to. A read (the next changeset of a
 * branch, a page window following the selection) keeps it.
 */
export function collapsesWithHost(expanded: boolean, diffs: HostDiffs): boolean {
  return expanded && diffs === 'none';
}

/** The words of the diff header's button and the palette's command, by whether the diff is expanded. */
export interface ExpandDiffWords {
  label: string;
  /** What the button's tooltip says under the label: how to leave, before expanding. */
  hint?: string;
}

/** `escapeKeys` is how Esc reads on this OS (`formatShortcut`): the hint says how to leave before the mode starts. */
export function expandDiffWords(expanded: boolean, escapeKeys: string): ExpandDiffWords {
  return expanded ? { label: 'Collapse diff' } : { label: 'Expand diff', hint: `${escapeKeys} to collapse` };
}
