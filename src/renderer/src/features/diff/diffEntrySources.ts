import type { ContentSource } from '@shared/domain/content';
import type { DiffEntry, PermissionsChange } from '@shared/domain/diff';
import { revisionIn, type RevisionRef } from '@shared/domain/revision';
import { statusTones } from '../../components/changeFilter';
import { statusGroup, type StatusGroup } from '../../components/statusGroups';
import type { GroupedFileListFacts } from '../../components/useGroupedFileTree';
import type { StatusMark } from '../../components/ItemStatusMark';
import type { StatusTone } from '../../components/StatusBadge';

const EMPTY: ContentSource = { kind: 'empty' };

/** The two revisions to compare for an entry, in its repository; a missing side (added/deleted item) is empty. */
export function diffEntrySources(entry: DiffEntry): { original: ContentSource; modified: ContentSource } {
  return {
    original: revisionSource(revisionIn(entry.repository, entry.baseRevisionId), entry.oldPath ?? entry.path),
    modified: revisionSource(revisionIn(entry.repository, entry.revisionId), entry.path),
  };
}

function revisionSource(revision: RevisionRef | null, path: string): ContentSource {
  return revision ? { kind: 'revision', revision, fileName: path } : EMPTY;
}

/** A moved item whose content also changed. */
export function isMovedAndChanged(entry: DiffEntry): boolean {
  return entry.status === 'moved' && entry.baseRevisionId !== entry.revisionId;
}

const TONES: Record<DiffEntry['status'], StatusTone> = {
  added: 'added',
  changed: 'changed',
  deleted: 'deleted',
  moved: 'moved',
};

const LABELS: Record<DiffEntry['status'], string> = {
  added: 'Added',
  changed: 'Changed',
  deleted: 'Deleted',
  moved: 'Moved',
};

/** What an item whose file permissions alone changed (`DiffEntry.permissionsChange`) is called, as its FS badge says. */
const ONLY_PERMISSIONS = 'Only file permissions changed';

/** An entry's status: a change of the file permissions alone is one of its own, as reviewers can pass over it. */
export function diffEntryTone(entry: DiffEntry): StatusTone {
  return entry.permissionsChange ? 'permissions' : TONES[entry.status];
}

function diffEntryLabel(entry: DiffEntry): string {
  return entry.permissionsChange ? ONLY_PERMISSIONS : LABELS[entry.status];
}

/**
 * What a diff's list knows of each entry beyond its path, to sort and group it (`useGroupedFileTree`): its own status,
 * the one its row shows last, and a group per status.
 */
export const DIFF_ENTRY_FACTS: GroupedFileListFacts<DiffEntry, StatusGroup> = { toneOf: diffEntryTone, statusGroup };

/** The statuses the filter chips find an entry by: a moved file that changed by C and M. */
export function diffEntryTones(entry: DiffEntry): readonly StatusTone[] {
  return statusTones(diffEntryTone(entry), isMovedAndChanged(entry));
}

/** An entry's status letter, a moved file that changed with a C before its M; the M's tooltip shows the move itself. */
export function diffEntryStatus(entry: DiffEntry): StatusMark {
  if (isMovedAndChanged(entry)) return { tone: 'moved', label: LABELS.moved, changedLabel: LABELS.changed };
  return { tone: diffEntryTone(entry), label: diffEntryLabel(entry) };
}

export function describeDiffEntry(entry: DiffEntry): string {
  if (isMovedAndChanged(entry)) return 'Moved and changed';
  return entry.oldPath ? `${LABELS[entry.status]} from ${entry.oldPath}` : diffEntryLabel(entry);
}

/**
 * What a diff shows, in place of its content, for an item whose file permissions alone changed: which changed. The
 * same for a text, a binary, an image or a folder, whose content is the same on both sides. Null for any other item.
 */
export function permissionsNote(entry: DiffEntry): string | null {
  return entry.permissionsChange ? describePermissionsChange(entry.permissionsChange) : null;
}

function describePermissionsChange(change: PermissionsChange): string {
  const [before, after] = [unbroken(change.before), unbroken(change.after)];
  const changed = 'Only the file permissions changed';
  if (before && after) return `${changed}, from ${before} to ${after}.`;
  if (after) return `${changed}: they are now ${after}.`;
  if (before) return `${changed}: they were ${before}.`;
  return `${changed}.`;
}

const NON_BREAKING_HYPHEN = '\u2011';

/** Permissions as one word: a line would otherwise break at their hyphens, leaving `-r--r-` on one line and `-r--` on the next. */
function unbroken(permissions: string | null): string | null {
  return permissions && permissions.replaceAll('-', NON_BREAKING_HYPHEN);
}
