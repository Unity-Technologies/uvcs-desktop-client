import type { TreeGroup } from '../lib/groupedPathTree';
import type { FileListFacts } from './fileListOrder';
import { toneRank, TONE_LABELS } from './changeFilter';
import type { StatusTone } from './StatusBadge';

/** A group of files of one status, as a list that groups by status knows it (`GroupedFileListFacts.statusGroup`), unless it has a group type of its own (Changes' `ChangeGroup`). */
export interface StatusGroup {
  status: StatusTone;
}

/** How the lists shown by `FileTreeList` know a status group: by its status. */
export const statusGroup = (status: StatusTone): StatusGroup => ({ status });

/** Whether a list's group is a status group (`statusGroup`), which `FileTreeList` heads with its status's badge. */
export function isStatusGroup(group: unknown): group is StatusGroup {
  return typeof group === 'object' && group !== null && 'status' in group;
}

interface StatusGroupsInput<T, G> {
  /** The items, in `comparePaths` order: each group keeps it. */
  sorted: readonly T[];
  toneOf: (item: T) => StatusTone;
  /** Unique in the list, for the groups' keys: a changelist's, so each changelist's Added group closes alone. */
  scope: string;
  /** What the list knows each group by. */
  groupOf: (tone: StatusTone) => G;
  /** Words of the list's own for some statuses, as its chips say them (`ChangeFilterOptions.toneLabels`). */
  toneLabels?: Partial<Record<StatusTone, string>>;
}

/**
 * The items in a group per status, in the chips' order (`toneRank`), only the statuses some item has. Each item is in
 * one group, its own status's: a moved file that changed is a moved one, as its row's last letter says.
 */
export function statusGroupsOf<T, G>({ sorted, toneOf, scope, groupOf, toneLabels = {} }: StatusGroupsInput<T, G>): TreeGroup<T, G>[] {
  const byTone = new Map<StatusTone, T[]>();
  for (const item of sorted) {
    const tone = toneOf(item);
    const items = byTone.get(tone);
    if (items) items.push(item);
    else byTone.set(tone, [item]);
  }
  return [...byTone.keys()]
    .sort((a, b) => toneRank(a) - toneRank(b))
    .map((tone) => ({ key: statusGroupKey(scope, tone), label: toneLabels[tone] ?? TONE_LABELS[tone], group: groupOf(tone), sorted: byTone.get(tone)! }));
}

/** The key of a status group's row: `status:<scope>:<tone>`, so closing it is remembered as other groups' are. */
export function statusGroupKey(scope: string, tone: StatusTone): string {
  return `status:${scope}:${tone}`;
}

/** What a list of changed files shows: its items in groups, each with its header, or all of them without any. */
export type FileListContent<T, G> = { groups: readonly TreeGroup<T, G>[] } | { sorted: T[] };

export interface GroupedFileListFacts<T, G> extends FileListFacts<T> {
  /**
   * How the list knows a group of the files of one status, when its files can go in one per status; undefined where
   * its own groups already say what happens to each file (the merge page's conflicts and changes).
   */
  statusGroup?: (tone: StatusTone) => G;
  /** Its chips' words for some statuses (`ChangeFilterOptions.toneLabels`), for its status groups. */
  toneLabels?: Partial<Record<StatusTone, string>>;
}

/** The list's files in a group per status: inside each of its own groups, or as its only groups. */
export function withStatusGroups<T, G>(content: FileListContent<T, G>, { toneOf, toneLabels, statusGroup }: GroupedFileListFacts<T, G>): TreeGroup<T, G>[] {
  const groupOf = statusGroup!;
  const byStatus = (sorted: readonly T[], scope: string) => statusGroupsOf<T, G>({ sorted, toneOf, scope, groupOf, toneLabels });
  if (!('groups' in content)) return byStatus(content.sorted, 'all');
  return content.groups.map((group) => ({ ...group, subgroups: byStatus(group.sorted, group.key) }));
}

/**
 * The groups a list shows: its own, with a group per status inside each when grouping by status (`withStatusGroups`);
 * the status groups alone for a list without groups of its own; null for a list shown without groups. A list that
 * offers no status groups (`statusGroup` undefined: the merge page) keeps its own groups whatever is chosen.
 */
export function fileListGroupsOf<T, G>(content: FileListContent<T, G>, groupByStatus: boolean, facts: GroupedFileListFacts<T, G>): readonly TreeGroup<T, G>[] | null {
  if (groupByStatus && facts.statusGroup) return withStatusGroups(content, facts);
  return 'groups' in content ? content.groups : null;
}
