import { create } from 'zustand';
import { expandableDiffInFront, expandedAfterToggle, type ExpandableDiff } from './diffExpansion';

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
  useDiffExpansionStore.setState({ expanded });
  if (expanded) requestAnimationFrame(focusExpandedDiff);
}

/**
 * Lets the command reach this diff while it is in front; returns its removal. The mode outlives a diff gone for a
 * moment (the next file's or changeset's read, a page window following the selection), so a diff leaving doesn't end it.
 */
export function registerExpandableDiff(diff: ExpandableDiff): () => void {
  mounted.add(diff);
  return () => mounted.delete(diff);
}

function isInFront(element: HTMLElement): boolean {
  return element.isConnected && element.closest('[hidden]') === null;
}

/**
 * Gives the keyboard to the expanded diff when what held it went out of sight with the files (expanded from the list
 * with the shortcut): the arrows scroll the code, ⌥↓ steps through its changes.
 */
function focusExpandedDiff(): void {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body && active.checkVisibility()) return;
  const diff = [...mounted].find((candidate) => isInFront(candidate.element));
  diff?.element.closest('[data-diff-frame]')?.querySelector<HTMLElement>('[tabindex="0"]')?.focus({ preventScroll: true });
}
