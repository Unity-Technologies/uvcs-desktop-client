import { FileSearch, Folder } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { folderListScope } from '../../components/collapsedFoldersStore';
import { useChangeFilter } from '../../components/useChangeFilter';
import { useFileTree } from '../../components/useFileTree';
import type { TreeFolderRow } from '../../lib/pathTree';
import { pluralize } from '../../lib/text';
import { EMPTY_SELECTION, singleSelection, type SelectionState } from '../../lib/selection';
import { EmptyState } from '../../ui/EmptyState';
import { SplitPane } from '../../ui/SplitPane';
import { ReviewModeButton } from '../review/ReviewModeButton';
import { diffEntryTones } from './diffEntrySources';
import { DiffEntryList, diffEntryKey } from './DiffEntryList';
import { diffEntryMenu } from './diffEntryMenu';
import { entryToFocus } from './diffFocus';
import { EntryDiff } from './EntryDiff';
import { listedEntries } from './listedEntries';
import { useDiffReview } from './review/useDiffReview';
import { FileStepsContext, useFileSteps } from './viewer/fileSteps';
import { AssetsPointContext, diffAssetsPoint } from './viewer/model/assetsPoints';
import { diffSibling, SiblingFinderContext } from './viewer/model/modelSiblings';

interface DiffBrowserProps {
  target: DiffTarget;
  entries: DiffEntry[];
  /** The file to open on (by its path, or its old path for a move); the first file when it isn't in the diff. */
  initialPath?: string;
}

/** A list of changed files next to the diff of the selected one. */
export function DiffBrowser({ target, entries: diffEntries, initialPath }: DiffBrowserProps) {
  const workspacePath = useWorkspacePath();
  const entries = useMemo(() => listedEntries(diffEntries), [diffEntries]);
  const review = useDiffReview(target, entries);
  const [selection, setSelection] = useState<SelectionState>(() => {
    const initial = entryToFocus(entries, initialPath);
    return initial ? singleSelection(diffEntryKey(initial)) : EMPTY_SELECTION;
  });
  const focused = entries.find((entry) => diffEntryKey(entry) === selection.anchor);
  const firstKey = entries[0] && diffEntryKey(entries[0]);
  const filter = useChangeFilter(entries, diffEntryKey, diffEntryTones, { isViewFilter: true, actions: <ReviewModeButton workspacePath={workspacePath} /> });
  const shown = useMemo(() => review.narrow(filter.visible), [review.narrow, filter.visible]);
  const { rows, tree, toggleCollapsed } = useFileTree(shown, diffEntryKey, folderListScope(workspacePath, `diff:${JSON.stringify(target)}`), selection.anchor);
  // A folder the keyboard (or a click) is on, in a tree.
  const focusedFolder = focused ? undefined : rows.find((row): row is TreeFolderRow<DiffEntry> => row.type === 'folder' && row.key === selection.anchor);
  // The diff's change navigation goes on to the files before and after, as the list shows them.
  const rowKeys = useMemo(() => rows.flatMap((row) => (row.type === 'file' && row.item.itemType !== 'directory' ? [row.key] : [])), [rows]);
  // A model's companions (a glTF's `.bin`) are entries of the same diff, or the files where it points to.
  const workspaceRepository = useWorkspaceInfo().data?.repository;
  const findSibling = useMemo(() => diffSibling(diffEntries, target, workspaceRepository), [diffEntries, target, workspaceRepository]);
  // A model's materials and textures are the ones where the diff points to, the side before with its changes undone.
  const findAssetsPoint = useMemo(() => diffAssetsPoint(diffEntries, target), [diffEntries, target]);
  const fileSteps = useFileSteps({ keys: rowKeys, current: selection.anchor, select: (key) => setSelection(singleSelection(key)), pathOf: (key) => key });

  useEffect(() => {
    if (!focused && !focusedFolder && firstKey) setSelection(singleSelection(firstKey));
  }, [focused, focusedFolder, firstKey]);

  if (entries.length === 0) {
    return <EmptyState icon={<FileSearch size={22} />} title="No differences" description="There are no file changes to show." />;
  }

  return (
    <SplitPane
      initialSize={340}
      minSize={220}
      maxSize={640}
      first={
        <DiffEntryList
          rows={rows}
          tree={tree}
          toggleCollapsed={toggleCollapsed}
          query={filter.query}
          filterBar={filter.bar}
          selection={selection}
          onSelectionChange={setSelection}
          contextMenu={(selected) => diffEntryMenu(workspacePath, target, selected, review)}
          review={review}
        />
      }
      second={
        focused ? (
          <FileStepsContext.Provider value={fileSteps}>
            <SiblingFinderContext.Provider value={findSibling}>
              <AssetsPointContext.Provider value={findAssetsPoint}>
                <EntryDiff workspacePath={workspacePath} entry={focused} reviewMarks={review.marks} />
              </AssetsPointContext.Provider>
            </SiblingFinderContext.Provider>
          </FileStepsContext.Provider>
        ) : focusedFolder ? (
          <EmptyState icon={<Folder size={24} />} title={focusedFolder.path} description={`${pluralize(focusedFolder.items.length, 'change')}. Select a file to see its diff.`} />
        ) : null
      }
    />
  );
}
