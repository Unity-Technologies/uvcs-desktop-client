import { pluralize } from '../../lib/text';
import type { GraphTarget } from './canvas/graphTargets';
import type { GraphLayout } from './model/layoutGraph';

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

/** How something was picked: `toggle` with Ctrl (⌘ on macOS), `context` the right-click that opens its menu. */
export interface SelectGesture {
  toggle: boolean;
  context: boolean;
}

/** What is selected after a click or a right-click on the target. */
export function selectedOnGesture(current: GraphSelections, target: GraphTarget | null, gesture: SelectGesture): GraphSelections {
  return (gesture.context ? selectedOnContextClick : selectedOnClick)(current, target, gesture.toggle);
}

function isLaidOut(selection: GraphSelection, layout: GraphLayout): boolean {
  switch (selection.kind) {
    case 'changeset':
      if (selection.label === undefined) return layout.nodes.has(selection.id);
      return layout.labelsByChangeset.get(selection.id)?.some((label) => label.name === selection.label) ?? false;
    case 'branch':
      return layout.lanesByBranch.has(selection.name);
    case 'pending':
      return layout.pending !== null;
  }
}

/**
 * A selection of several keeps only what the graph still shows once it is laid out again, so a menu or a count never
 * includes a branch just hidden or deleted. One selected stays as it is: going to a changeset selects it before the
 * graph has laid it out. Unchanged, it is the same array, so nothing renders again.
 */
export function selectionsLaidOut(selections: GraphSelections, layout: GraphLayout): GraphSelections {
  if (selections.length < 2) return selections;
  const kept = selections.filter((selection) => isLaidOut(selection, layout));
  return kept.length === selections.length ? selections : kept;
}

/** What the graph draws as selected: the lead, and every selected changeset and branch, all in the same selection color. */
export interface SelectionHighlights {
  /** The lead's, when it is a changeset (a label's is its changeset). */
  selectedChangeset: number | null;
  selectedBranch: string | null;
  selectedPending: boolean;
  /** Every changeset selected, the lead's included; labels select theirs. */
  selectedChangesets: ReadonlySet<number>;
  selectedBranches: ReadonlySet<string>;
}

export function selectionHighlights(selections: GraphSelections): SelectionHighlights {
  const lead = leadOf(selections);
  return {
    selectedChangeset: lead?.kind === 'changeset' ? lead.id : null,
    selectedBranch: lead?.kind === 'branch' ? lead.name : null,
    selectedPending: lead?.kind === 'pending',
    selectedChangesets: new Set(selections.flatMap((selection) => (selection.kind === 'changeset' ? [selection.id] : []))),
    selectedBranches: new Set(selections.flatMap((selection) => (selection.kind === 'branch' ? [selection.name] : []))),
  };
}

const GROUP_NOUNS: Record<SelectionGroup, [singular: string, plural: string]> = {
  changeset: ['changeset', 'changesets'],
  label: ['label', 'labels'],
  branch: ['branch', 'branches'],
  pending: ['pending change', 'pending changes'],
};

/** What the details and screen readers say of a selection of several, since the details show one object. */
export interface SeveralSelected {
  /** "3 branches selected". */
  summary: string;
  hint: string;
}

/** What a selection of several is; null for one or none, which the details show as themselves. */
export function severalSelected(selections: GraphSelections): SeveralSelected | null {
  const lead = leadOf(selections);
  if (!lead || selections.length < 2) return null;
  const [singular, plural] = GROUP_NOUNS[groupOf(lead)];
  return { summary: `${pluralize(selections.length, singular, plural)} selected`, hint: `Select one ${singular} to see its details.` };
}
