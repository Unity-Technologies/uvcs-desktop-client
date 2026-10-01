import type { ContentSource } from '@shared/domain/content';
import type { DiffEntry } from '@shared/domain/diff';
import { revisionIn, type RevisionRef } from '@shared/domain/revision';
import { statusTones } from '../../components/changeFilter';
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

export function diffEntryTone(entry: DiffEntry): StatusTone {
  return TONES[entry.status];
}

/** The statuses the filter chips find an entry by: a moved file that changed by C and M. */
export function diffEntryTones(entry: DiffEntry): readonly StatusTone[] {
  return statusTones(diffEntryTone(entry), isMovedAndChanged(entry));
}

/** An entry's status letter, a moved file that changed with a C before its M; the M's tooltip shows the move itself. */
export function diffEntryStatus(entry: DiffEntry): StatusMark {
  if (isMovedAndChanged(entry)) return { tone: 'moved', label: LABELS.moved, changedLabel: LABELS.changed };
  return { tone: diffEntryTone(entry), label: LABELS[entry.status] };
}

export function describeDiffEntry(entry: DiffEntry): string {
  if (isMovedAndChanged(entry)) return 'Moved and changed';
  return entry.oldPath ? `${LABELS[entry.status]} from ${entry.oldPath}` : LABELS[entry.status];
}
