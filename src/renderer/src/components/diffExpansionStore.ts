import { useEffect } from 'react';
import { flushSync } from 'react-dom';
import { create } from 'zustand';
import { isInFront } from '../lib/inFront';
import { focusMain } from '../lib/mainFocus';
import type { ShortcutId } from '../lib/shortcutRegistry';
import {
  collapsesWithHost,
  expandableDiffInFront,
  expandedAfterToggle,
  focusGoesToDiff,
  focusGoesToDiffOnCollapse,
  focusHolderOf,
  shortcutWhileExpanded,
  type AskedBy,
  type ExpandableDiff,
  type HostDiffs,
} from './diffExpansion';

/**
 * Whether the window's diff is expanded (`diffExpansion.ts`): one per window, never remembered past it. `registrations`
 * counts Expand buttons coming and going (`useExpandableDiffsChanged`).
 */
const useDiffExpansionStore = create<{ expanded: boolean; registrations: number }>(() => ({ expanded: false, registrations: 0 }));

/** The Expand buttons on screen, each in a diff's header; views stay mounted under pages, so being here isn't enough. */
const mounted = new Set<ExpandableDiff>();

/** Whether the diff in front is expanded: the layouts around it hide what isn't the diff. */
export function useDiffExpanded(): boolean {
  return useDiffExpansionStore((state) => state.expanded);
}

/** The same, outside React: a key handler deciding whether Esc is its own. */
export function isDiffExpanded(): boolean {
  return useDiffExpansionStore.getState().expanded;
}

/** Ends the mode: Esc, the button pressed again, a navigation away from the diff, the place left. */
export function collapseDiff(): void {
  useDiffExpansionStore.setState({ expanded: false });
}

/**
 * Collapses the expanded diff as the user asked (Esc, the command, the button), leaving the keyboard on its code where
 * it would be left nowhere or on a button a click focused (`focusGoesToDiffOnCollapse`): given while the code is still
 * the main focus, ringless, as the app moved it.
 */
export function collapseDiffAsAsked(by: AskedBy): void {
  if (!isDiffExpanded()) return;
  if (focusGoesToDiffOnCollapse(focusHolder(), by)) focusMain(document, 'app');
  collapseDiff();
}

/** Expands the diff in front, or collapses an expanded one; nothing where no diff can expand. */
export function toggleDiffExpanded(by: AskedBy): void {
  if (!expandedAfterToggle(isDiffExpanded(), isExpandableDiffInFront())) return collapseDiffAsAsked(by);
  // Drawn at once (`flushSync`): the code is the main focus and the list out of sight before the keyboard moves.
  flushSync(() => useDiffExpansionStore.setState({ expanded: true }));
  focusExpandedDiff();
}

/**
 * Runs a window shortcut of a part an expanded diff stows (`shortcutWhileExpanded`): as ever, or once the window is
 * given back and drawn again (`flushSync`), so what it acts on is in sight and can take the caret, or not at all.
 */
export function runWhileDiffExpanded(id: ShortcutId, run: () => void): void {
  const effect = isDiffExpanded() ? shortcutWhileExpanded(id) : 'acts';
  if (effect === 'off') return;
  if (effect !== 'acts') flushSync(collapseDiff);
  if (effect !== 'collapseOnly') run();
}

/**
 * Whether a stowed part's window shortcut takes its key now: not while the diff is expanded where it is `off`
 * (`shortcutWhileExpanded`), so the key goes on to what is in sight. Pass it as `useShortcut`'s `enabled`.
 */
export function useShortcutOnWhileExpanded(id: ShortcutId): boolean {
  const expanded = useDiffExpanded();
  return !expanded || shortcutWhileExpanded(id) !== 'off';
}

/**
 * Ends the mode once the view showing the diff settles with nothing to diff (`collapsesWithHost`): a view in front only,
 * whose diff went with its files, never one hidden under a page whose expanded diff is still in front.
 */
export function useCollapseWithHost(diffs: HostDiffs): void {
  useEffect(() => {
    if (collapsesWithHost(isDiffExpanded(), diffs, isExpandableDiffInFront())) collapseDiff();
  }, [diffs]);
}

/** Whether a diff that can expand is in front now. */
export function isExpandableDiffInFront(): boolean {
  return expandableDiffInFront(mounted, isInFront);
}

/** Changes as Expand buttons come and go, for what shows whether one is in front (the palette's command). */
export function useExpandableDiffsChanged(): number {
  return useDiffExpansionStore((state) => state.registrations);
}

/**
 * Lets the command reach this diff while it is in front; returns its removal. The mode outlives a diff gone for a
 * moment (the next file's or changeset's read, a page window following the selection), so a diff leaving doesn't end it.
 */
export function registerExpandableDiff(diff: ExpandableDiff): () => void {
  mounted.add(diff);
  countRegistration();
  return () => {
    mounted.delete(diff);
    countRegistration();
  };
}

function countRegistration(): void {
  useDiffExpansionStore.setState((state) => ({ registrations: state.registrations + 1 }));
}

/**
 * Gives the keyboard to the expanded diff (`focusGoesToDiff`) when what held it went out of sight with the files, or
 * was a button (the Expand button, a change arrow): the arrows scroll the code, ⌥↓ steps through its changes and Esc
 * drops a picked change before it collapses the diff.
 */
function focusExpandedDiff(): void {
  if (![...mounted].some((candidate) => isInFront(candidate.element))) return;
  // The code is the window's main focus while expanded (`useExpandedDiffFocus`); an image or a model has none to take.
  if (focusGoesToDiff(focusHolder())) focusMain(document, 'app');
}

/** What holds the keyboard now. */
function focusHolder() {
  return focusHolderOf(document.activeElement, document.body);
}
