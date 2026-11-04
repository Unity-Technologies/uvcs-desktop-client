import type { GraphChangeset, GraphLabel } from '@shared/domain/branchExplorer';
import type { GraphLayout, NodeLayout } from '../model/layoutGraph';
import { ascending, countBetween, sortedSearch } from './sortedSearch';

const MAIN_BRANCH = '/main';

/** A label with the column and time of its changeset. */
export interface TimedLabel {
  label: GraphLabel;
  column: number;
  time: number;
}

/**
 * What the Timeline reads of a layout, measured once per layout (`timelineHistory`): every date parsed once and
 * sorted, so whatever the strip asks later (a curve, a hover's counts) is a binary search, never a walk.
 * Times are ms since the epoch.
 */
export interface TimelineHistory {
  layout: GraphLayout;
  /** The time of each column's changeset; a "+N" node's is its first changeset's, where it is drawn. */
  columnTimes: Float64Array;
  /** How many changesets the columns before each one hold (a "+N" node holds several); one more entry than columns. */
  changesetsBefore: Int32Array;
  /** Every changeset's time, ascending. */
  times: Float64Array;
  /** The times of /main's changesets a merge (not a cherry pick or a subtractive merge) landed on, each once, ascending. */
  mainMergeTimes: Float64Array;
  /** The labels, by their changeset's time. */
  labels: readonly TimedLabel[];
  labelTimes: Float64Array;
  /** /main's changesets, by id. */
  mainIds: Float64Array;
  /** The column of /main's newest changeset; null with none in the graph. */
  newestMainColumn: number | null;
  /** The oldest changeset in the graph, by id. */
  firstId: number;
  /** The oldest and newest times. */
  start: number;
  end: number;
}

const histories = new WeakMap<GraphLayout, TimelineHistory>();

/** The layout's history as the Timeline reads it; the same object for the same layout. */
export function timelineHistory(layout: GraphLayout): TimelineHistory {
  let history = histories.get(layout);
  if (!history) histories.set(layout, (history = measureHistory(layout)));
  return history;
}

/** Every changeset a column holds: a "+N" node's run, else its one changeset. */
export function changesetsOf(node: NodeLayout): readonly GraphChangeset[] {
  return node.collapsed ?? [node.changeset];
}

function measureHistory(layout: GraphLayout): TimelineHistory {
  const columnCount = layout.nodesByColumn.length;
  const columnTimes = new Float64Array(columnCount);
  const changesetsBefore = new Int32Array(columnCount + 1);
  const times: number[] = [];
  const timeById = new Map<number, number>();
  const mainIds: number[] = [];
  let newestMainColumn: number | null = null;

  layout.nodesByColumn.forEach((node, column) => {
    const members = changesetsOf(node);
    for (const changeset of members) {
      const time = Date.parse(changeset.date);
      times.push(time);
      timeById.set(changeset.id, time);
      if (changeset.branch === MAIN_BRANCH) {
        mainIds.push(changeset.id);
        newestMainColumn = column;
      }
    }
    columnTimes[column] = timeById.get(node.changeset.id)!;
    changesetsBefore[column + 1] = changesetsBefore[column]! + members.length;
  });

  // Merges only (no cherry pick or subtractive), each changeset on /main once however many branches it merged.
  const mergedIntoMain = new Set(
    layout.mergeLinks
      .filter((link) => link.type === 'merge' && branchOf(layout, link.destinationChangeset) === MAIN_BRANCH)
      .map((link) => link.destinationChangeset),
  );
  const mainMergeTimes = [...mergedIntoMain].map((id) => timeById.get(id)!);
  const labels = [...layout.labelsByChangeset.values()]
    .flat()
    .map((label) => ({ label, column: layout.nodes.get(label.changeset)!.column, time: timeById.get(label.changeset)! }))
    .sort((a, b) => a.time - b.time || a.column - b.column);
  const sortedTimes = ascending(times);

  return {
    layout,
    columnTimes,
    changesetsBefore,
    times: sortedTimes,
    mainMergeTimes: ascending(mainMergeTimes),
    labels,
    labelTimes: Float64Array.from(labels, (label) => label.time),
    mainIds: ascending(mainIds),
    newestMainColumn,
    firstId: layout.nodesByColumn[0]?.changeset.id ?? 0,
    start: sortedTimes[0] ?? 0,
    end: sortedTimes.at(-1) ?? 0,
  };
}

/** The branch of a changeset in the layout; a merge's destination is never folded into a "+N" node, but look anyway. */
function branchOf(layout: GraphLayout, id: number): string | undefined {
  const node = layout.nodes.get(id)!;
  return changesetsOf(node).find((changeset) => changeset.id === id)?.branch;
}

/** How many changesets columns `first` to `last` hold, both included. */
export function changesetsInColumns(history: TimelineHistory, first: number, last: number): number {
  const count = history.columnTimes.length;
  const from = Math.max(0, first);
  const to = Math.min(count - 1, last);
  return to < from ? 0 : history.changesetsBefore[to + 1]! - history.changesetsBefore[from]!;
}

/** How many of /main's changesets in the graph are newer than `id`: how far /main moved on since. */
export function mainChangesetsAfter(history: TimelineHistory, id: number): number {
  return history.mainIds.length - sortedSearch.upperBound(history.mainIds, id);
}

/** Whose changesets stand out as the user's share: their times ascending, and the columns holding one. */
export interface TimelineShare {
  times: Float64Array;
  /** 1 where the column holds one of their changesets. */
  columns: Uint8Array;
}

const shares = new WeakMap<TimelineHistory, WeakMap<ReadonlySet<string>, TimelineShare>>();

/** The changesets by `owners` (the user, or the people filter's picks); the same object for the same history and set. */
export function timelineShare(history: TimelineHistory, owners: ReadonlySet<string>): TimelineShare {
  let byOwners = shares.get(history);
  if (!byOwners) shares.set(history, (byOwners = new WeakMap()));
  let share = byOwners.get(owners);
  if (!share) byOwners.set(owners, (share = measureShare(history, owners)));
  return share;
}

function measureShare(history: TimelineHistory, owners: ReadonlySet<string>): TimelineShare {
  const columns = new Uint8Array(history.columnTimes.length);
  const times: number[] = [];
  history.layout.nodesByColumn.forEach((node, column) => {
    const theirs = changesetsOf(node).filter((changeset) => owners.has(changeset.owner));
    if (theirs.length === 0) return;
    columns[column] = 1;
    for (const changeset of theirs) times.push(Date.parse(changeset.date));
  });
  return { times: ascending(times), columns };
}

/** How many changesets were made in [from, to). */
export function changesetsBetween(times: Float64Array, from: number, to: number): number {
  return countBetween(times, from, to - 1);
}
