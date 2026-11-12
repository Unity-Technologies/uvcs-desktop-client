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
import { pairIncomingMetas } from './incomingMetaPairs';
import { INCOMING_FILE_FACTS, INCOMING_TONE_LABELS, incomingFileContent, incomingFileTones, scopeDiffToRead, scopeKey, type IncomingListGroup, type IncomingScope } from './incomingScope';

const NO_FILES: DiffEntry[] = [];
const noMeta = (): DiffEntry | undefined => undefined;

/**
 * The files Incoming lists for a scope, filtered and laid out as every list of changed files is. The whole update's
 * come with the incoming changes; a changeset's are its diff, and several changesets' their range diff, read once the
 * selection settles (`useSettledValue`) and kept for good, the very query a details panel elsewhere reads
 * (`useDiffEntries`). A Unity asset's `.meta` rides on its row (`pairIncomingMetas`, `metaOf`): `files` are the rows,
 * undefined until the scope's files are in.
 */
export function useIncomingFiles(scope: IncomingScope, updateFiles: DiffEntry[], collides: (file: DiffEntry) => boolean, selectedKey: string | null) {
  const workspacePath = useWorkspacePath();
  const settled = useSettledValue(scope, scopeKey(scope));
  const isSettled = scopeKey(settled) === scopeKey(scope);
  const changesetTarget = scopeDiffToRead(settled);
  const { data: changesetFiles } = useDiffEntries(changesetTarget);
  const allListed = useMemo(() => listedEntries(updateFiles), [updateFiles]);
  const changesetListed = useMemo(() => changesetFiles && listedEntries(changesetFiles), [changesetFiles]);
  const listed = scope.kind === 'all' ? allListed : isSettled ? changesetListed : undefined;
  const pairs = useMemo(() => listed && pairIncomingMetas(listed, collides), [listed, collides]);
  const files = pairs?.shown;
  const metaOf = pairs?.metaOf ?? noMeta;

  const tonesOf = useCallback((file: DiffEntry) => incomingFileTones(file, collides(file)), [collides]);
  const filter = useChangeFilter(files ?? NO_FILES, diffEntryKey, tonesOf, { isViewFilter: true, reading: !files, toneLabels: INCOMING_TONE_LABELS });
  const content = useMemo<FileListContent<DiffEntry, IncomingListGroup>>(
    // Only the whole update is what updating merges: a changeset's files are what it did, without groups.
    () => (scope.kind === 'all' ? incomingFileContent(filter.visible, collides) : { sorted: filter.visible }),
    [scope.kind, filter.visible, collides],
  );
  const tree = useGroupedFileTree(content, files ?? NO_FILES, diffEntryKey, folderListScope(workspacePath, `incoming:${scopeKey(scope)}`), INCOMING_FILE_FACTS, selectedKey);
  return { files, metaOf, filter, ...tree };
}
