import { FilePlus, FolderPlus, RefreshCw, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { invalidateWorkspace } from '../../app/queryClient';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { ListWithDetails } from '../../components/ListWithDetails';
import { NoSelection } from '../../components/NoSelection';
import { EMPTY_SELECTION, type SelectionState } from '../../lib/selection';
import { EmptyState } from '../../ui/EmptyState';
import { HighlightQuery } from '../../ui/Highlight';
import { IconButton } from '../../ui/IconButton';
import { SearchField } from '../../ui/SearchField';
import { CenteredSpinner } from '../../ui/Spinner';
import { ViewHeader } from '../../ui/ViewHeader';
import { usePendingChanges } from '../pendingChanges/usePendingChanges';
import { useExpandedDirectories, useExpandedDirectoriesStore } from './expandedDirectoriesStore';
import { fileMenu, FILE_SHORTCUTS } from './fileMenu';
import { createItem, openItem, targetDirectoryFor } from './fileOperations';
import { useFilesViewStore } from './filesViewStore';
import { FileTreeTable } from './FileTreeTable';
import { ancestorsOf, buildFileTreeRows } from './fileTreeRows';
import { goToFile } from './GoToFileDialog';
import { ItemDetailsPane } from './ItemDetailsPane';
import { itemStatus, PendingChangesIndex } from './itemStatus';
import { GO_TO_FILE_SHORTCUT, useFileCommands } from './useFileCommands';
import { useTreeListings } from './useTreeListings';
import { WorkspaceRootDetails } from './WorkspaceRootDetails';
import { isWorkspaceRoot, workspaceRootItem } from './workspaceRoot';

/** The workspace explorer: every file on disk with its version-control status. */
export function FilesView() {
  const workspacePath = useWorkspacePath();
  const { data: workspace } = useWorkspaceInfo();
  const [rootExpanded, setRootExpanded] = useState(true);
  const expanded = useExpandedDirectories(workspacePath);
  const { toggle, expand } = useExpandedDirectoriesStore();
  const { data: pendingChanges } = usePendingChanges();
  const [filter, setFilter] = useState('');
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const [revealPath, setRevealPath] = useState<string | null>(null);

  const { childrenByDirectory, isLoadingRoot, error } = useTreeListings(
    (directory) => queryKeys.inWorkspace(workspacePath, 'explorer', 'directory', directory),
    (directory) => api.explorer.listDirectory(workspacePath, directory),
    expanded,
  );
  const pendingIndex = useMemo(() => new PendingChangesIndex(pendingChanges?.changes ?? []), [pendingChanges]);
  const root = useMemo(() => workspace && { item: workspaceRootItem(workspace), expanded: rootExpanded }, [workspace, rootExpanded]);
  const rows = useMemo(() => buildFileTreeRows({ childrenByDirectory, expanded, filter, root }), [childrenByDirectory, expanded, filter, root]);
  const selectedItems = useMemo(() => rows.filter((row) => selection.selected.has(row.item.path)).map((row) => row.item), [rows, selection]);
  const focused = rows.find((row) => row.item.path === selection.anchor)?.item;

  const revealRequest = useFilesViewStore((state) => state.revealRequest);
  useEffect(() => {
    if (!revealRequest) return;
    const { path } = revealRequest;
    expand(workspacePath, ancestorsOf(path));
    setFilter('');
    setSelection({ selected: new Set([path]), anchor: path });
    setRevealPath(path);
  }, [revealRequest, expand, workspacePath]);

  const openGoToFile = useCallback(
    () => void goToFile(workspacePath).then((path) => path && useFilesViewStore.getState().requestReveal(path)),
    [workspacePath],
  );
  useFileCommands(workspacePath, selectedItems, openGoToFile);

  const createInSelection = (kind: 'file' | 'directory'): void => void createItem(workspacePath, targetDirectoryFor(focused), kind);

  const header = (
    <ViewHeader
      title="Files"
      subtitle={workspacePath}
      actions={
        <>
          <IconButton icon={<Search size={14} />} label="Go to file" shortcut={GO_TO_FILE_SHORTCUT} onClick={openGoToFile} />
          <IconButton icon={<FilePlus size={14} />} label="New file" shortcut={FILE_SHORTCUTS.newFile} onClick={() => createInSelection('file')} />
          <IconButton icon={<FolderPlus size={14} />} label="New folder" shortcut={FILE_SHORTCUTS.newFolder} onClick={() => createInSelection('directory')} />
          <IconButton icon={<RefreshCw size={14} />} label="Refresh" shortcut="mod+r" onClick={() => void invalidateWorkspace(workspacePath)} />
        </>
      }
    >
      <SearchField value={filter} onChange={setFilter} placeholder="Filter open folders" />
    </ViewHeader>
  );

  if (isLoadingRoot) return <>{header}<CenteredSpinner /></>;
  if (error) return <>{header}<EmptyState title="Couldn't list the workspace" description={error.message} /></>;

  return (
    <>
      {header}
      <ListWithDetails
        list={
          <HighlightQuery query={filter}>
            <FileTreeTable
              rows={rows}
              selection={selection}
              onSelectionChange={setSelection}
              onToggleDirectory={(directory) => (directory === '' ? setRootExpanded((shown) => !shown) : toggle(workspacePath, directory))}
              onOpenFile={(item) => openItem(workspacePath, item)}
              contextMenu={(items) => fileMenu(workspacePath, items, pendingIndex)}
              statusOf={(item) => itemStatus(item, pendingIndex)}
              hasChangesInside={(directory) => pendingIndex.hasChangesInside(directory)}
              revealPath={revealPath}
            />
          </HighlightQuery>
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
