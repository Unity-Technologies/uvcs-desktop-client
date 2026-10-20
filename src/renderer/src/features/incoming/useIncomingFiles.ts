import { useCallback, useMemo } from 'react';
import type { DiffEntry } from '@shared/domain/diff';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { folderListScope } from '../../components/collapsedFoldersStore';
import { useChangeFilter } from '../../components/useChangeFilter';
import { useGroupedFileTree, type FileListContent } from '../../components/useGroupedFileTree';
import { useSettledValue } from '../../lib/useSettled';
import { diffEntryKey } from '../diff/DiffEntryList';
import { listedEntries } from '../diff/listedEntries';
import { useDiffEntries } from '../diff/useDiffEntries';
import { INCOMING_TONE_LABELS, incomingFileContent, incomingFileTones, scopeKey, type IncomingFileGroup, type IncomingScope } from './incomingScope';

const NO_FILES: DiffEntry[] = [];

/**
 * The files Incoming lists for a scope, filtered and laid out as every list of changed files is. The whole update's
 * come with the incoming changes; a changeset's are its diff, read once its row stays selected (`useSettledValue`)
 * and kept for good, the very query its details panel elsewhere reads (`useDiffEntries`). `files` is undefined until
 * the scope's files are in.
 */
export function useIncomingFiles(scope: IncomingScope, updateFiles: DiffEntry[], collides: (file: DiffEntry) => boolean, selectedKey: string | null) {
  const workspacePath = useWorkspacePath();
  const settled = useSettledValue(scope, scopeKey(scope));
  const isSettled = scopeKey(settled) === scopeKey(scope);
  const changesetTarget = settled.kind === 'changeset' ? ({ kind: 'changeset', changesetId: settled.id } as const) : null;
  const { data: changesetFiles } = useDiffEntries(changesetTarget);
  const allListed = useMemo(() => listedEntries(updateFiles), [updateFiles]);
  const changesetListed = useMemo(() => changesetFiles && listedEntries(changesetFiles), [changesetFiles]);
  const files = scope.kind === 'all' ? allListed : isSettled ? changesetListed : undefined;

  const tonesOf = useCallback((file: DiffEntry) => incomingFileTones(file, collides(file)), [collides]);
  const filter = useChangeFilter(files ?? NO_FILES, diffEntryKey, tonesOf, { isViewFilter: true, reading: !files, toneLabels: INCOMING_TONE_LABELS });
  const content = useMemo<FileListContent<DiffEntry, IncomingFileGroup>>(
    // Only the whole update is what updating merges: a changeset's files are what it did, without groups.
    () => (scope.kind === 'all' ? incomingFileContent(filter.visible, collides) : { sorted: filter.visible }),
    [scope.kind, filter.visible, collides],
  );
  const tree = useGroupedFileTree(content, diffEntryKey, folderListScope(workspacePath, `incoming:${scopeKey(scope)}`), selectedKey);
  return { files, filter, ...tree };
}
