import { FilePlus, FolderPlus, RefreshCw, Search } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { invalidateWorkspace } from '../../app/queryClient';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { selectAfterLeaving } from '../../app/navigation/leaveGuard';
import { useViewSelection } from '../../app/navigation/viewSelectionStore';
import { ListWithDetails } from '../../components/ListWithDetails';
import { NoSelection } from '../../components/NoSelection';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { HighlightQuery } from '../../ui/Highlight';
import { IconButton } from '../../ui/IconButton';
import { SearchField } from '../../ui/SearchField';
import { ListSkeleton } from '../../ui/Skeleton';
import { ViewHeader } from '../../ui/ViewHeader';
import { usePendingChanges } from '../pendingChanges/usePendingChanges';
import { useExpandedDirectories, useExpandedDirectoriesStore } from './expandedDirectoriesStore';
import { fileMenu, FILE_SHORTCUTS } from './fileMenu';
import { useCutItems } from './cutItemsStore';
import { CutHint } from './CutHint';
import { createItem, openItem, targetDirectoryFor } from './fileOperations';
import { useFilesViewStore } from './filesViewStore';
import { FileTreeTable } from './FileTreeTable';
import { ancestorsOf, buildFileTreeRows } from './fileTreeRows';
import { goToFile } from './GoToFileDialog';
import { ItemDetailsPane } from './ItemDetailsPane';
import { itemStatus, PendingChangesIndex } from './itemStatus';
import { GO_TO_FILE_SHORTCUT, useFileCommands } from './useFileCommands';
import { useCutPasteCommands } from './useCutPasteCommands';
import { useTreeListings } from './useTreeListings';
import { hotkey } from '../../lib/shortcutRegistry';
import { WorkspaceRootDetails } from './WorkspaceRootDetails';
import { isWorkspaceRoot, workspaceRootItem } from './workspaceRoot';

/** A file's details show its content and last change: they get more room than an object's meta. */
const FILE_DETAILS_WIDTH = { initial: 560, min: 320, max: 1200 };

/** The workspace explorer: every file on disk with its version-control status. */
export function FilesView() {
  const workspacePath = useWorkspacePath();
  const { data: workspace } = useWorkspaceInfo();
  const [rootExpanded, setRootExpanded] = useState(true);
  const expanded = useExpandedDirectories(workspacePath);
  const { toggle, expand } = useExpandedDirectoriesStore();
  const { data: pendingChanges } = usePendingChanges();
  const [filter, setFilter] = useState('');
  // The field shows each keystroke at once; tens of thousands of open rows are filtered right after.
  const shownFilter = useDeferredValue(filter);
  const [selection, setSelection] = useViewSelection('files');
  const [revealPath, setRevealPath] = useState<string | null>(null);

  const { childrenByDirectory, isLoadingRoot, error } = useTreeListings(
    (directory) => queryKeys.inWorkspace(workspacePath, 'explorer', 'directory', directory),
    (directory) => api.explorer.listDirectory(workspacePath, directory),
    expanded,
  );
  const pendingIndex = useMemo(() => new PendingChangesIndex(pendingChanges?.changes ?? []), [pendingChanges]);
  const root = useMemo(() => workspace && { item: workspaceRootItem(workspace), expanded: rootExpanded }, [workspace, rootExpanded]);
  const rows = useMemo(() => buildFileTreeRows({ childrenByDirectory, expanded, filter: shownFilter, root }), [childrenByDirectory, expanded, shownFilter, root]);
  const selectedItems = useMemo(() => rows.filter((row) => selection.selected.has(row.item.path)).map((row) => row.item), [rows, selection]);
  const focused = rows.find((row) => row.item.path === selection.anchor)?.item;

  const revealRequest = useFilesViewStore((state) => state.revealRequest);
  useEffect(() => {
    if (!revealRequest) return;
    const { path, selected = [path] } = revealRequest;
    expand(workspacePath, ancestorsOf(path));
    setFilter('');
    setSelection({ selected: new Set(selected), anchor: path });
    setRevealPath(path);
  }, [revealRequest, expand, workspacePath]);

  const openGoToFile = useCallback(
    (query?: string) => void goToFile(workspacePath, query).then((path) => path && useFilesViewStore.getState().requestReveal(path)),
    [workspacePath],
  );
  useFileCommands(workspacePath, selectedItems, pendingIndex, openGoToFile);
  useCutPasteCommands(workspacePath, selectedItems);
  const cutItems = useCutItems(workspacePath);
  const cutPaths = useMemo(() => new Set(cutItems.map((item) => item.path)), [cutItems]);
  const nothingMatches = shownFilter.trim() !== '' && rows.every((row) => isWorkspaceRoot(row.item));

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
      <SearchField value={filter} onChange={setFilter} placeholder="Filter open folders" />
      <CutHint workspacePath={workspacePath} />
    </ViewHeader>
  );

  if (isLoadingRoot) return <>{header}<ListSkeleton rowHeight={28} /></>;
  if (error) return <>{header}<EmptyState title="Couldn't list the workspace" description={error.message} /></>;

  return (
    <>
      {header}
      <ListWithDetails widthKey="files" widthLimits={FILE_DETAILS_WIDTH}
        list={
          nothingMatches ? (
            <EmptyState
              icon={<Search size={22} />}
              title={`Nothing in the open folders matches “${shownFilter.trim()}”`}
              action={<Button onClick={() => openGoToFile(filter.trim())}>Search all files</Button>}
            />
          ) : (
            <HighlightQuery query={shownFilter}>
              <FileTreeTable
                rows={rows}
                selection={selection}
                onSelectionChange={(next) => selectAfterLeaving(selection, next, setSelection)}
                onToggleDirectory={(directory) => (directory === '' ? setRootExpanded((shown) => !shown) : toggle(workspacePath, directory))}
                onOpenFile={(item) => openItem(workspacePath, item)}
                contextMenu={(items) => fileMenu(workspacePath, items, pendingIndex)}
                statusOf={(item) => itemStatus(item, pendingIndex)}
                hasChangesInside={(directory) => pendingIndex.hasChangesInside(directory)}
                revealPath={revealPath}
                isCut={(item) => cutPaths.has(item.path)}
              />
            </HighlightQuery>
          )
        }
        details={
          focused && workspace && isWorkspaceRoot(focused) ? (
            <WorkspaceRootDetails workspace={workspace} menu={fileMenu(workspacePath, [focused], pendingIndex)} />
          ) : focused ? (
            <ItemDetailsPane
              key={focused.path}
              workspacePath={workspacePath}
              item={focused}
              pendingChange={pendingIndex.changeAt(focused.path)}
              menu={fileMenu(workspacePath, [focused], pendingIndex)}
            />
          ) : (
            <NoSelection noun="file" />
          )
        }
      />
    </>
  );
}
