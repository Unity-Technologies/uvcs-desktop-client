import type { ContentSource } from '@shared/domain/content';
import type { DiffEntry } from '@shared/domain/diff';
import type { StatusTone } from '../../components/StatusBadge';

const EMPTY: ContentSource = { kind: 'empty' };

/** The two revisions to compare for an entry; a missing side (added/deleted item) is empty. */
export function diffEntrySources(entry: DiffEntry): { original: ContentSource; modified: ContentSource } {
  return {
    original: revisionSource(entry.baseRevisionId, entry.oldPath ?? entry.path),
    modified: revisionSource(entry.revisionId, entry.path),
  };
}

function revisionSource(revisionId: number, path: string): ContentSource {
  return revisionId === -1 ? EMPTY : { kind: 'revision', revisionId, fileName: path };
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

export function describeDiffEntry(entry: DiffEntry): string {
  if (isMovedAndChanged(entry)) return 'Moved and changed';
  return entry.oldPath ? `${LABELS[entry.status]} from ${entry.oldPath}` : LABELS[entry.status];
}
