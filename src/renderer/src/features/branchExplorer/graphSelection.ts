import type { GraphTarget } from './canvas/graphTargets';

/**
 * What the details panel shows. Labels and merge links select the changeset they point to (a label naming itself, so
 * the details show the label's); merges in progress, where they come from. The workspace's pending changes are
 * selected as the changeset they will become.
 */
export type GraphSelection = { kind: 'changeset'; id: number; label?: string } | { kind: 'branch'; name: string } | { kind: 'pending' };

export function selectionFor(target: GraphTarget | null): GraphSelection | null {
  switch (target?.kind) {
    case 'changeset':
      return { kind: 'changeset', id: target.id };
    case 'label':
      return { kind: 'changeset', id: target.label.changeset, label: target.label.name };
    case 'mergeLink':
      return { kind: 'changeset', id: target.link.destinationChangeset };
    case 'pendingMergeLink':
      return { kind: 'changeset', id: target.link.sourceChangeset };
    case 'branch':
      return { kind: 'branch', name: target.lane.branch.name };
    case 'pending':
      return { kind: 'pending' };
    default:
      return null;
  }
}

/**
 * Everything selected: one object, or several of one kind picked with Ctrl+click (⌘ on macOS). The last one picked
 * leads: it is what the keyboard moves from, the details and the following window show, and the graph keeps on
 * screen as it is laid out again.
 */
export type GraphSelections = readonly GraphSelection[];

export const NOTHING_SELECTED: GraphSelections = [];

/** What can be selected together: changesets, labels or branches, each with its own kind only. */
type SelectionGroup = 'changeset' | 'label' | 'branch' | 'pending';

function groupOf(selection: GraphSelection): SelectionGroup {
  if (selection.kind === 'changeset') return selection.label === undefined ? 'changeset' : 'label';
  return selection.kind;
}

/** Only what has a menu for several joins a selection: a merge link or the pending changes always select alone. */
function joinsSelection(target: GraphTarget): boolean {
  return target.kind === 'changeset' || target.kind === 'label' || target.kind === 'branch';
}

function sameSelection(a: GraphSelection, b: GraphSelection): boolean {
  return selectionKey(a) === selectionKey(b);
}

function selectionKey(selection: GraphSelection): string {
  switch (selection.kind) {
    case 'changeset':
      return selection.label === undefined ? `changeset:${selection.id}` : `label:${selection.label}`;
    case 'branch':
      return `branch:${selection.name}`;
    case 'pending':
      return 'pending';
  }
}

export function leadOf(selections: GraphSelections): GraphSelection | null {
  return selections.at(-1) ?? null;
}

/** Whether what the target selects is in the selection, so its menu is the selection's. */
export function isSelected(selections: GraphSelections, target: GraphTarget | null): boolean {
  const selection = selectionFor(target);
  return selection !== null && selections.some((selected) => sameSelection(selected, selection));
}

/**
 * A click selects what it lands on, alone. With Ctrl (⌘ on macOS) it adds it to the selection or takes it out,
 * when it is of the selection's kind; another kind starts a new selection. Ctrl+clicking empty space changes nothing.
 */
export function selectedOnClick(current: GraphSelections, target: GraphTarget | null, toggle: boolean): GraphSelections {
  const selection = selectionFor(target);
  if (!selection) return toggle ? current : NOTHING_SELECTED;
  if (!toggle || !joinsSelection(target!)) return [selection];
  const first = current[0];
  if (first === undefined || groupOf(first) !== groupOf(selection)) return [selection];
  return isSelected(current, target) ? current.filter((selected) => !sameSelection(selected, selection)) : [...current, selection];
}

/**
 * A right-click on something selected keeps the selection, so its menu is for all of it; on anything else it
 * selects that first, as a click would, with Ctrl adding it.
 */
export function selectedOnContextClick(current: GraphSelections, target: GraphTarget | null, toggle: boolean): GraphSelections {
  if (target && joinsSelection(target) && isSelected(current, target)) return current;
  return selectedOnClick(current, target, toggle);
}

/** What the graph draws as selected (the lead, and every selected changeset and branch), and in which color. */
export interface SelectionHighlights {
  /** The lead's, when it is a changeset (a label's is its changeset). */
  selectedChangeset: number | null;
  selectedBranch: string | null;
  selectedPending: boolean;
  /** Every changeset selected, the lead's included; labels select theirs. */
  selectedChangesets: ReadonlySet<number>;
  selectedBranches: ReadonlySet<string>;
  /** Several things are selected: they are drawn in the multiple selection's color. */
  multipleSelection: boolean;
}

export function selectionHighlights(selections: GraphSelections): SelectionHighlights {
  const lead = leadOf(selections);
  return {
    selectedChangeset: lead?.kind === 'changeset' ? lead.id : null,
    selectedBranch: lead?.kind === 'branch' ? lead.name : null,
    selectedPending: lead?.kind === 'pending',
    selectedChangesets: new Set(selections.flatMap((selection) => (selection.kind === 'changeset' ? [selection.id] : []))),
    selectedBranches: new Set(selections.flatMap((selection) => (selection.kind === 'branch' ? [selection.name] : []))),
    multipleSelection: selections.length > 1,
  };
}
