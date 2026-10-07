import type { DiffEntry } from '@shared/domain/diff';
import { ConflictStatusChip } from '../merge/ConflictStatusChip';
import type { ConflictStatus } from '../merge/mergeStatus';
import { UPDATE_LABELS } from './updateConflictFiles';

interface IncomingConflictMarkProps {
  file: DiffEntry;
  /** Paths that changed locally too. */
  conflictPaths: ReadonlySet<string>;
  /** Where each of those stands, once its versions are read, as on the merge page; the merge tool it's open in or was resolved in. */
  conflictStates: ReadonlyMap<string, { status: ConflictStatus; tool?: string }>;
  /** Paths changed locally that the branch deleted or moved (by their old path): they block the update. */
  blockedPaths: ReadonlySet<string>;
}

/** Where a file changed on both sides stands, as on the merge page: the letter stays what the branch did to it. */
export function IncomingConflictMark({ file, conflictPaths, conflictStates, blockedPaths }: IncomingConflictMarkProps) {
  if (blockedPaths.has(file.oldPath ?? file.path)) {
    const explanation = `Changed locally, ${file.status === 'deleted' ? 'deleted' : 'moved'} on the branch: shelve it to update`;
    return <ConflictStatusChip status="needsDecision" labels={UPDATE_LABELS} explanation={explanation} compact />;
  }
  if (!conflictPaths.has(file.path)) return null;
  const conflict = conflictStates.get(file.path);
  return <ConflictStatusChip status={conflict?.status ?? 'reading'} labels={UPDATE_LABELS} tool={conflict?.tool} compact />;
}
