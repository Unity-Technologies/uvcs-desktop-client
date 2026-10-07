import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import { spec } from '@shared/domain/specs';
import type { StatusTone } from '../../components/StatusBadge';
import type { FileListContent } from '../../components/useGroupedFileTree';
import { diffEntryTones } from '../diff/diffEntrySources';

/** What Incoming's files show: everything the update brings, or what one incoming changeset changed. */
export type IncomingScope = { kind: 'all' } | { kind: 'changeset'; id: number };

export const ALL_INCOMING: IncomingScope = { kind: 'all' };

/** The groups of the files the update brings, when some of them changed locally too. */
export type IncomingFileGroup = 'bothSides' | 'branchOnly';

export const INCOMING_GROUP_TIPS: Record<IncomingFileGroup, string> = {
  bothSides: 'Changed locally too: they merge as you update',
  branchOnly: 'Changed on the branch only',
};

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
 * The files of the whole update as the list shows them: those changed on both sides in a group of their own, first,
 * when there are any (they are what the update needs the user for), then the rest; without groups otherwise.
 */
export function incomingFileContent(files: DiffEntry[], collides: (file: DiffEntry) => boolean): FileListContent<DiffEntry, IncomingFileGroup> {
  const bothSides = files.filter(collides);
  if (bothSides.length === 0) return { sorted: files };
  const branchOnly = files.filter((file) => !collides(file));
  return {
    groups: [
      { key: 'group:bothSides', label: 'Changed on both sides', group: 'bothSides', sorted: bothSides },
      ...(branchOnly.length > 0 ? [{ key: 'group:branchOnly', label: 'Changed on the branch', group: 'branchOnly' as const, sorted: branchOnly }] : []),
    ],
  };
}

/** A file's statuses for the filter's chips: what the branch did to it, and "Conflicts" when it collides with local changes. */
export function incomingFileTones(file: DiffEntry, collides: boolean): readonly StatusTone[] {
  return collides ? [...diffEntryTones(file), 'conflict'] : diffEntryTones(file);
}

/** The file Incoming opens on: the first that changed on both sides, or else the first file. */
export function firstIncomingFile(files: DiffEntry[], collides: (file: DiffEntry) => boolean): DiffEntry | undefined {
  return files.find(collides) ?? files[0];
}
