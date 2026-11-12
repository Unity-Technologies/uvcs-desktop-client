import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import { spec } from '@shared/domain/specs';
import type { ChangesetListChoice } from '../../components/changesetList/changesetListChoice';
import type { StatusTone } from '../../components/StatusBadge';
import { formatCount, pluralize } from '../../lib/text';
import { isStatusGroup, statusGroup, type FileListContent, type GroupedFileListFacts, type StatusGroup } from '../../components/statusGroups';
import { DIFF_ENTRY_FACTS, diffEntryTones } from '../diff/diffEntrySources';

/**
 * What Incoming's files show: everything the update brings, what one incoming changeset changed, or what several did,
 * as one diff from the oldest one's parent to the newest (`target`).
 */
export type IncomingScope = { kind: 'all' } | { kind: 'changeset'; id: number } | { kind: 'span'; target: Extract<DiffTarget, { kind: 'range' }> };

const ALL_INCOMING: IncomingScope = { kind: 'all' };

/**
 * The scope the changesets' list selects (`changesetListChoice`). Several changesets show their own range diff, not
 * the update's: what they did, as a changeset's files are, without the conflicts, which only the whole update merges.
 */
export function incomingScopeOf(choice: ChangesetListChoice): IncomingScope {
  if (choice.kind === 'changeset') return { kind: 'changeset', id: choice.changesetId };
  if (choice.kind === 'span') return { kind: 'span', target: choice.target };
  return ALL_INCOMING;
}

/**
 * The groups of the files the update brings, when some of them collide with local changes: an update with conflicts
 * is a merge, so they read as the merge page's groups do, naming what the update does to the user's workspace.
 */
export type IncomingFileGroup = 'conflicts' | 'changes';

/** A group of Incoming's list: one of its own, or the files of one status when the list is grouped by status. */
export type IncomingListGroup = IncomingFileGroup | StatusGroup;

/**
 * What Incoming's list knows of each file to sort and group it (`useGroupedFileTree`): what the branch did to it,
 * its own groups saying whether it conflicts.
 */
export const INCOMING_FILE_FACTS: GroupedFileListFacts<DiffEntry, IncomingListGroup> = { toneOf: DIFF_ENTRY_FACTS.toneOf, statusGroup };

/** What a group of Incoming's list is, as its tooltip: its own groups say; a status group's name does. */
export function incomingGroupTip(group: IncomingListGroup): string | undefined {
  return isStatusGroup(group) ? undefined : INCOMING_GROUP_TIPS[group];
}

export const INCOMING_GROUP_TIPS: Record<IncomingFileGroup, string> = {
  conflicts: 'Changed by you and on the branch, or deleted or moved on the branch while you changed them',
  changes: 'Your workspace takes them as they are',
};

/** The filter's chip for files that collide, in the groups' words. */
export const INCOMING_TONE_LABELS: Partial<Record<StatusTone, string>> = { conflict: 'Conflicts with your changes' };

export function scopeKey(scope: IncomingScope): string {
  if (scope.kind === 'all') return 'all';
  return scope.kind === 'changeset' ? `changeset:${scope.id}` : `span:${scope.target.fromSpec}:${scope.target.toSpec}`;
}

/**
 * The diff a scope's files are read from (`useIncomingFiles`): the changeset's own, or the span's range; none for the
 * whole update, whose files come with the incoming changes.
 */
export function scopeDiffToRead(scope: IncomingScope): DiffTarget | null {
  if (scope.kind === 'changeset') return { kind: 'changeset', changesetId: scope.id };
  return scope.kind === 'span' ? scope.target : null;
}

/** The diff the scope's files come from, for their menu: the whole update (loaded → head), or the scope's own. */
export function incomingDiffTarget(scope: IncomingScope, loadedChangeset: number, headChangeset: number): DiffTarget {
  return scopeDiffToRead(scope) ?? { kind: 'range', fromSpec: spec.changeset(loadedChangeset), toSpec: spec.changeset(headChangeset) };
}

/** Where local changes and the update meet: a file changed on both sides, or one changed locally the branch deleted or moved (by its old path). */
export function collidesWithLocal(file: DiffEntry, conflictPaths: ReadonlySet<string>, blockedPaths: ReadonlySet<string>): boolean {
  return conflictPaths.has(file.path) || blockedPaths.has(file.oldPath ?? file.path);
}

/**
 * The files of the whole update as the list shows them: those that conflict with local changes in a group of their
 * own, first, when there are any (they are what the update needs the user for), then the changes to apply; without
 * groups otherwise.
 */
export function incomingFileContent(files: DiffEntry[], collides: (file: DiffEntry) => boolean): FileListContent<DiffEntry, IncomingListGroup> {
  const conflicts = files.filter(collides);
  if (conflicts.length === 0) return { sorted: files };
  const changes = files.filter((file) => !collides(file));
  return {
    groups: [
      { key: 'group:conflicts', label: 'Conflicts with your changes', group: 'conflicts', sorted: conflicts },
      ...(changes.length > 0 ? [{ key: 'group:changes', label: 'Changes to apply', group: 'changes' as const, sorted: changes }] : []),
    ],
  };
}

/** A file's statuses for the filter's chips: what the branch did to it, and "Conflicts" when it collides with local changes. */
export function incomingFileTones(file: DiffEntry, collides: boolean): readonly StatusTone[] {
  return collides ? [...diffEntryTones(file), 'conflict'] : diffEntryTones(file);
}

/**
 * The line under the files' header: what the update does to the workspace, "1 conflict with your changes · 13 to
 * apply", or "14 changes to apply · Your local changes stay as they are"; a changeset's files (or several's) are what it
 * did, counted.
 */
export function incomingFilesSummary(scope: IncomingScope, fileCount: number, conflictCount: number): string {
  if (scope.kind !== 'all') return pluralize(fileCount, 'change');
  const toApply = fileCount - conflictCount;
  if (conflictCount === 0) return `${pluralize(fileCount, 'change')} to apply · Your local changes stay as they are`;
  const conflicts = pluralize(conflictCount, 'conflict with your changes', 'conflicts with your changes');
  return toApply > 0 ? `${conflicts} · ${formatCount(toApply)} to apply` : conflicts;
}

/**
 * The file a scope opens on: in the whole update the first that changed on both sides, or else the first file; for
 * several changesets the first; none for one changeset, whose details show until a file is picked.
 */
export function firstIncomingFile(scope: IncomingScope, files: DiffEntry[], collides: (file: DiffEntry) => boolean): DiffEntry | undefined {
  if (scope.kind === 'changeset') return undefined;
  return scope.kind === 'all' ? (files.find(collides) ?? files[0]) : files[0];
}
