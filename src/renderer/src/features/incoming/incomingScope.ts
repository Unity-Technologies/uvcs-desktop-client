import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import { spec } from '@shared/domain/specs';
import type { StatusTone } from '../../components/StatusBadge';
import type { FileListContent } from '../../components/useGroupedFileTree';
import { formatCount, pluralize } from '../../lib/text';
import { diffEntryTones } from '../diff/diffEntrySources';

/** What Incoming's files show: everything the update brings, or what one incoming changeset changed. */
export type IncomingScope = { kind: 'all' } | { kind: 'changeset'; id: number };

export const ALL_INCOMING: IncomingScope = { kind: 'all' };

/**
 * The groups of the files the update brings, when some of them collide with local changes: an update with conflicts
 * is a merge, so they read as the merge page's groups do, naming what the update does to the user's workspace.
 */
export type IncomingFileGroup = 'conflicts' | 'changes';

export const INCOMING_GROUP_TIPS: Record<IncomingFileGroup, string> = {
  conflicts: 'Changed by you and on the branch, or deleted or moved on the branch while you changed them',
  changes: 'Your workspace takes them as they are',
};

/** The filter's chip for files that collide, in the groups' words. */
export const INCOMING_TONE_LABELS: Partial<Record<StatusTone, string>> = { conflict: 'Conflicts with your changes' };

export function scopeKey(scope: IncomingScope): string {
  return scope.kind === 'all' ? 'all' : `changeset:${scope.id}`;
}

/** The diff the scope's files come from, for their menu: the whole update (loaded → head), or the changeset's own. */
export function incomingDiffTarget(scope: IncomingScope, loadedChangeset: number, headChangeset: number): DiffTarget {
  if (scope.kind === 'changeset') return { kind: 'changeset', changesetId: scope.id };
  return { kind: 'range', fromSpec: spec.changeset(loadedChangeset), toSpec: spec.changeset(headChangeset) };
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
export function incomingFileContent(files: DiffEntry[], collides: (file: DiffEntry) => boolean): FileListContent<DiffEntry, IncomingFileGroup> {
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
 * apply", or "14 changes to apply · Your local changes stay as they are"; a changeset's files are what it did, counted.
 */
export function incomingFilesSummary(scope: IncomingScope, fileCount: number, conflictCount: number): string {
  if (scope.kind === 'changeset') return pluralize(fileCount, 'change');
  const toApply = fileCount - conflictCount;
  if (conflictCount === 0) return `${pluralize(fileCount, 'change')} to apply · Your local changes stay as they are`;
  const conflicts = pluralize(conflictCount, 'conflict with your changes', 'conflicts with your changes');
  return toApply > 0 ? `${conflicts} · ${formatCount(toApply)} to apply` : conflicts;
}

/** The file Incoming opens on: the first that changed on both sides, or else the first file. */
export function firstIncomingFile(files: DiffEntry[], collides: (file: DiffEntry) => boolean): DiffEntry | undefined {
  return files.find(collides) ?? files[0];
}
