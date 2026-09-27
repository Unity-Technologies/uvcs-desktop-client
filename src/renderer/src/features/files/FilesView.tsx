import { FilePlus, FolderPlus, RefreshCw, Search } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { invalidateWorkspace } from '../../app/queryClient';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { selectAfterLeaving } from '../../app/navigation/leaveGuard';
import { useViewSelection } from '../../app/navigation/viewSelectionStore';
import { ListWithDetails } from '../../components/ListWithDetails';
import { NoSelection } from '../../components/NoSelection';
import { focusMain } from '../../lib/mainFocus';
import { EMPTY_SELECTION, type SelectionState } from '../../lib/selection';
import { EmptyState } from '../../ui/EmptyState';
import { IconButton } from '../../ui/IconButton';
import { SearchField } from '../../ui/SearchField';
import { ListSkeleton } from '../../ui/Skeleton';
import { ViewHeader } from '../../ui/ViewHeader';
import { usePendingLocks } from '../pendingChanges/locks/usePendingLocks';
import { usePendingChanges } from '../pendingChanges/usePendingChanges';
import { useExpandedDirectories, useExpandedDirectoriesStore } from './expandedDirectoriesStore';
import { fileMenu, FILE_SHORTCUTS } from './fileMenu';
import { useCutItems } from './cutItemsStore';
import { CutHint } from './CutHint';
import { createItem, openItem, targetDirectoryFor } from './fileOperations';
import { useFilesViewStore } from './filesViewStore';
import { FileFindResults } from './FileFindResults';
import { FileTreeTable } from './FileTreeTable';
import { FILE_TREE_WIDTH } from './fileTreeWidth';
import { ancestorsOf, buildFileTreeRows } from './fileTreeRows';
import { goToFile } from './GoToFileDialog';
import { ItemDetailsPane } from './ItemDetailsPane';
import { itemStatus, PendingChangesIndex } from './itemStatus';
import { GO_TO_FILE_SHORTCUT, useFileCommands } from './useFileCommands';
import { useCutPasteCommands } from './useCutPasteCommands';
import { useTreeListings } from './useTreeListings';
import { useFoundItem, useWorkspaceFind } from './useWorkspaceFind';
import { hotkey } from '../../lib/shortcutRegistry';
import { WorkspaceRootDetails } from './WorkspaceRootDetails';
import { isWorkspaceRoot, workspaceRootItem } from './workspaceRoot';

const NO_CHANGES: PendingChange[] = [];

/** The workspace explorer: every file on disk with its version-control status. */
export function FilesView() {
  const workspacePath = useWorkspacePath();
  const { data: workspace } = useWorkspaceInfo();
  const [rootExpanded, setRootExpanded] = useState(true);
  const expanded = useExpandedDirectories(workspacePath);
  const { toggle, expand } = useExpandedDirectoriesStore();
  const { data: pendingChanges, dataUpdatedAt: pendingChangesUpdatedAt } = usePendingChanges();
  const [query, setQuery] = useState('');
  // The field shows each keystroke at once; the whole workspace is ranked right after.
  const shownQuery = useDeferredValue(query);
  const finding = shownQuery.trim() !== '';
  const findRef = useRef<HTMLInputElement>(null);
  const [selection, setSelection] = useViewSelection('files');
  const [findSelection, setFindSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const [revealPath, setRevealPath] = useState<string | null>(null);

  const { childrenByDirectory, isLoadingRoot, error } = useTreeListings(
    (directory) => queryKeys.inWorkspace(workspacePath, 'explorer', 'directory', directory),
    (directory) => api.explorer.listDirectory(workspacePath, directory),
    expanded,
  );
  const pendingIndex = useMemo(() => new PendingChangesIndex(pendingChanges?.changes ?? []), [pendingChanges]);
  const locks = usePendingLocks(workspacePath, workspace?.repository, pendingChanges?.changes ?? NO_CHANGES, pendingChangesUpdatedAt);
  const root = useMemo(() => workspace && { item: workspaceRootItem(workspace), expanded: rootExpanded }, [workspace, rootExpanded]);
  const rows = useMemo(() => buildFileTreeRows({ childrenByDirectory, expanded, filter: '', root }), [childrenByDirectory, expanded, root]);
  const found = useWorkspaceFind(workspacePath, shownQuery);
  const foundItem = useFoundItem(workspacePath, finding ? findSelection.anchor : null);
  const treeSelected = useMemo(() => rows.filter((row) => selection.selected.has(row.item.path)).map((row) => row.item), [rows, selection]);
  const selectedItems = finding ? (foundItem ? [foundItem] : []) : treeSelected;
  const focused = finding ? foundItem : rows.find((row) => row.item.path === selection.anchor)?.item;

  const revealRequest = useFilesViewStore((state) => state.revealRequest);
  useEffect(() => {
    if (!revealRequest) return;
    const { path, selected = [path] } = revealRequest;
    expand(workspacePath, ancestorsOf(path));
    setQuery('');
    setSelection({ selected: new Set(selected), anchor: path });
    setRevealPath(path);
  }, [revealRequest, expand, workspacePath]);

  const openGoToFile = useCallback(
    (query?: string) => void goToFile(workspacePath, query).then((path) => path && useFilesViewStore.getState().requestReveal(path)),
    [workspacePath],
  );
  const find = useCallback(() => {
    findRef.current?.focus();
    findRef.current?.select();
  }, []);
  // Leaving the find (Esc, or a result revealed) gives the keys back to the tree once it's back on screen.
  const [returningToTree, setReturningToTree] = useState(false);
  useEffect(() => {
    if (finding || !returningToTree) return;
    setReturningToTree(false);
    focusMain(document);
  }, [finding, returningToTree]);
  const leaveFind = (): void => {
    setQuery('');
    setReturningToTree(true);
  };
  useFileCommands(workspacePath, selectedItems, pendingIndex, openGoToFile, find);
  useCutPasteCommands(workspacePath, selectedItems);
  const cutItems = useCutItems(workspacePath);
  const cutPaths = useMemo(() => new Set(cutItems.map((item) => item.path)), [cutItems]);

  const selectFolder = (path: string): void => {
    selectAfterLeaving(selection, { selected: new Set([path]), anchor: path }, setSelection);
    setRevealPath(path);
  };

  const createInSelection = (kind: 'file' | 'directory'): void => void createItem(workspacePath, targetDirectoryFor(focused), kind);

  const header = (
    <ViewHeader
      title="Files"
      subtitle={workspacePath}
      actions={
        <>
          <IconButton icon={<Search size={14} />} label="Go to file" shortcut={GO_TO_FILE_SHORTCUT} onClick={() => openGoToFile()} />
          <IconButton icon={<FilePlus size={14} />} label="New file" shortcut={FILE_SHORTCUTS.newFile} onClick={() => createInSelection('file')} />
          <IconButton icon={<FolderPlus size={14} />} label="New folder" shortcut={FILE_SHORTCUTS.newFolder} onClick={() => createInSelection('directory')} />
          <IconButton icon={<RefreshCw size={14} />} label="Refresh" shortcut={hotkey('refresh')} onClick={() => void invalidateWorkspace(workspacePath)} />
        </>
      }
    >
      <SearchField
        ref={findRef}
        value={query}
        onChange={(value) => {
          setQuery(value);
          setFindSelection(EMPTY_SELECTION);
        }}
        onCleared={() => setReturningToTree(true)}
        onKeyDown={(event) => {
          // Into the results, which select their first row.
          if (!finding || (event.key !== 'ArrowDown' && event.key !== 'Enter')) return;
          event.preventDefault();
          focusMain(document);
        }}
        placeholder="Find files"
        tip="Find files and folders in the whole workspace"
        shortcut={hotkey('filesFind')}
      />
      <CutHint workspacePath={workspacePath} />
    </ViewHeader>
  );

  if (isLoadingRoot) return <>{header}<ListSkeleton rowHeight={28} /></>;
  if (error) return <>{header}<EmptyState title="Couldn't list the workspace" description={error.message} /></>;

  return (
    <>
      {header}
      <ListWithDetails
        widthKey="filesTree"
        widthLimits={FILE_TREE_WIDTH}
        sized="list"
        list={
          finding ? (
            found.isLoading ? (
              <ListSkeleton rowHeight={28} />
            ) : found.items.length === 0 ? (
              <EmptyState icon={<Search size={22} />} title={`Nothing in the workspace matches “${shownQuery.trim()}”`} />
            ) : (
              <FileFindResults
                items={found.items}
                query={shownQuery}
                pendingIndex={pendingIndex}
                selection={findSelection}
                onSelectionChange={setFindSelection}
                onReveal={(path) => {
                  useFilesViewStore.getState().requestReveal(path);
                  setReturningToTree(true);
                }}
                onLeave={leaveFind}
                onFind={find}
                contextMenu={(paths) => (foundItem && paths.length === 1 && paths[0] === foundItem.path ? fileMenu(workspacePath, [foundItem], pendingIndex) : [])}
              />
            )
          ) : (
            <FileTreeTable
              rows={rows}
              selection={selection}
              onSelectionChange={(next) => selectAfterLeaving(selection, next, setSelection)}
              onToggleDirectory={(directory) => (directory === '' ? setRootExpanded((shown) => !shown) : toggle(workspacePath, directory))}
              onOpenFile={(item) => openItem(workspacePath, item)}
              contextMenu={(items) => fileMenu(workspacePath, items, pendingIndex)}
              statusOf={(item) => itemStatus(item, pendingIndex)}
              lockOf={(item) => locks.get(item.path)}
              hasChangesInside={(directory) => pendingIndex.hasChangesInside(directory)}
              revealPath={revealPath}
              isCut={(item) => cutPaths.has(item.path)}
              onFind={find}
            />
          )
        }
        details={
          focused && workspace && isWorkspaceRoot(focused) ? (
            <WorkspaceRootDetails workspace={workspace} menu={fileMenu(workspacePath, [focused], pendingIndex)} />
          ) : focused ? (
            <ItemDetailsPane
              workspacePath={workspacePath}
              item={focused}
              pendingIndex={pendingIndex}
              lock={locks.get(focused.path)}
              menu={fileMenu(workspacePath, [focused], pendingIndex)}
              onSelectFolder={(path) => (finding ? useFilesViewStore.getState().requestReveal(path) : selectFolder(path))}
              folderContents={childrenByDirectory.get(focused.path)}
            />
          ) : (
            <NoSelection noun={finding ? 'result' : 'file'} />
          )
        }
      />
    </>
  );
}
