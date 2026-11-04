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
  shortcutWhileExpanded,
  type ExpandableDiff,
  type HostDiffs,
} from './diffExpansion';

/** Whether the window's diff is expanded (`diffExpansion.ts`): one per window, never remembered past it. */
const useDiffExpansionStore = create<{ expanded: boolean }>(() => ({ expanded: false }));

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

/** Expands the diff in front, or collapses an expanded one; nothing where no diff can expand. */
export function toggleDiffExpanded(): void {
  const expanded = expandedAfterToggle(isDiffExpanded(), expandableDiffInFront(mounted, isInFront));
  // Drawn at once (`flushSync`): the code is the main focus and the list out of sight before the keyboard moves.
  flushSync(() => useDiffExpansionStore.setState({ expanded }));
  if (expanded) focusExpandedDiff();
}

/**
 * Runs a window shortcut of a part an expanded diff stows (`shortcutWhileExpanded`): as ever, or once the window is
 * given back and drawn again (`flushSync`), so what it acts on is in sight and can take the caret, or not at all.
 */
export function runWhileDiffExpanded(id: ShortcutId, run: () => void): void {
  const effect = isDiffExpanded() ? shortcutWhileExpanded(id) : 'acts';
  if (effect !== 'acts') flushSync(collapseDiff);
  if (effect !== 'collapseOnly') run();
}

/** Ends the mode once the view showing the diff settles with nothing to diff (`collapsesWithHost`). */
export function useCollapseWithHost(diffs: HostDiffs): void {
  useEffect(() => {
    if (collapsesWithHost(isDiffExpanded(), diffs)) collapseDiff();
  }, [diffs]);
}

/**
 * Lets the command reach this diff while it is in front; returns its removal. The mode outlives a diff gone for a
 * moment (the next file's or changeset's read, a page window following the selection), so a diff leaving doesn't end it.
 */
export function registerExpandableDiff(diff: ExpandableDiff): () => void {
  mounted.add(diff);
  return () => mounted.delete(diff);
}

/**
 * Gives the keyboard to the expanded diff (`focusGoesToDiff`) when what held it went out of sight with the files, or
 * was the Expand button itself: the arrows scroll the code, ⌥↓ steps through its changes and Esc drops a picked
 * change before it collapses the diff.
 */
function focusExpandedDiff(): void {
  const active = document.activeElement;
  const diff = [...mounted].find((candidate) => isInFront(candidate.element));
  if (!diff) return;
  const onBody = !(active instanceof HTMLElement) || active === document.body;
  const holder = { onBody, visible: !onBody && (active as HTMLElement).checkVisibility(), onExpandButton: active === diff.element };
  // The code is the window's main focus while expanded (`useExpandedDiffFocus`); an image or a model has none to take.
  if (focusGoesToDiff(holder)) focusMain(document);
}
