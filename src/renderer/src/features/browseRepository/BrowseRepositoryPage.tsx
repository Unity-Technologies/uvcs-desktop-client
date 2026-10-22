import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { revisionRef } from '@shared/domain/revision';
import type { PageProps } from '../../app/navigation/pages';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { ListWithDetails } from '../../components/ListWithDetails';
import { NoSelection } from '../../components/NoSelection';
import { EMPTY_SELECTION, singleSelection, type SelectionState } from '../../lib/selection';
import { EmptyState } from '../../ui/EmptyState';
import { HighlightQuery } from '../../ui/Highlight';
import { FilterBar } from '../../ui/FilterBar';
import { FilterField } from '../../ui/FilterField';
import { ViewHeader } from '../../ui/ViewHeader';
import { DetailsPanelSkeleton } from '../../ui/DetailsPanelSkeleton';
import { LineLinksContext, type LineLinks } from '../diff/viewer/lineLinks';
import { useFocusUntilMoved } from '../diff/viewer/useFocusUntilMoved';
import { useExpandedDirectories, useExpandedDirectoriesStore } from '../files/expandedDirectoriesStore';
import { FileTreeSkeleton, FileTreeTable } from '../files/FileTreeTable';
import { FILE_TREE_WIDTH } from '../files/fileTreeWidth';
import { ancestorsOf, buildFileTreeRows } from '../files/fileTreeRows';
import { useFilesViewStore } from '../files/filesViewStore';
import { ItemDetailsPane } from '../files/ItemDetailsPane';
import { useTreeListings } from '../files/useTreeListings';
import { openRevision } from '../history/revisionOperations';
import { repositoryListingQuery } from './repositoryListing';
import { revisionMenu } from './revisionMenu';

/**
 * The repository as it was at a changeset: read-only, no workspace needed. Opened on an item (`focusPath`, a link's),
 * its folders open and it's selected; on a file's lines (`focusLines`), the file shows annotated, scrolled to them.
 */
export function BrowseRepositoryPage({ page }: PageProps<'browseRepository'>) {
  const workspacePath = useWorkspacePath();
  const repository = useWorkspaceInfo().data?.repository;
  const treeId = `${workspacePath}#cs:${page.changesetId}`;
  const expanded = useExpandedDirectories(treeId);
  const toggle = useExpandedDirectoriesStore((state) => state.toggle);
  const [filter, setFilter] = useState('');
  // The field shows each keystroke at once; tens of thousands of open rows are filtered right after.
  const shownFilter = useDeferredValue(filter);
  const [selection, setSelection] = useState<SelectionState>(() => (page.focusPath ? singleSelection(page.focusPath) : EMPTY_SELECTION));
  const linkFocus = useFocusUntilMoved(page.focusPath && page.focusLines ? { path: page.focusPath, lines: page.focusLines } : null, selection.anchor ?? undefined);
  const lineLinks = useMemo<LineLinks>(() => ({ focus: linkFocus, publishes: true }), [linkFocus]);
  useEffect(() => {
    if (!page.focusPath) return;
    useExpandedDirectoriesStore.getState().expand(treeId, ancestorsOf(page.focusPath));
    // A file's lines show in its content, which Annotate shows whole: a diff may fold them away, or not have them.
    if (page.focusLines) useFilesViewStore.getState().setFileView('annotate');
  }, []);

  const { childrenByDirectory, isLoadingRoot, error } = useTreeListings((directory) => repositoryListingQuery(workspacePath, page.changesetId, directory), expanded);
  const rows = useMemo(() => buildFileTreeRows({ childrenByDirectory, expanded, filter: shownFilter }), [childrenByDirectory, expanded, shownFilter]);
  const focused = rows.find((row) => row.item.path === selection.anchor)?.item;
  const [revealPath, setRevealPath] = useState<string | null>(page.focusPath ?? null);
  const selectFolder = (path: string): void => {
    setSelection(singleSelection(path));
    setRevealPath(path);
  };

  const header = (
    <ViewHeader title={`Repository at changeset ${page.changesetId}`} subtitle="Read-only">
      <FilterBar text={<FilterField value={filter} onChange={setFilter} placeholder="Filter open folders" />} />
    </ViewHeader>
  );

  if (error) return <>{header}<EmptyState title="Couldn't browse the repository" description={error.message} /></>;

  return (
    <>
      {header}
      <ListWithDetails
        widthKey="browseRepositoryTree"
        widthLimits={FILE_TREE_WIDTH}
        sized="list"
        // The tree's own header over placeholder rows while the root is read: the layout never changes shape.
        list={
          isLoadingRoot ? (
            <FileTreeSkeleton />
          ) : (
            <HighlightQuery query={shownFilter}>
              <FileTreeTable
                rows={rows}
                selection={selection}
                onSelectionChange={setSelection}
                onToggleDirectory={(directory) => toggle(treeId, directory)}
                onOpenFile={(item) => void openRevision(workspacePath, revisionRef(item), item.name)}
                contextMenu={(items) => revisionMenu(workspacePath, page.changesetId, repository, items)}
                revealPath={revealPath}
              />
            </HighlightQuery>
          )
        }
        details={
          isLoadingRoot ? (
            <DetailsPanelSkeleton />
          ) : focused ? (
            <LineLinksContext.Provider value={lineLinks}>
              <ItemDetailsPane
                workspacePath={workspacePath}
                item={focused}
                menu={revisionMenu(workspacePath, page.changesetId, repository, [focused])}
                onSelectFolder={selectFolder}
                listings={childrenByDirectory}
              />
            </LineLinksContext.Provider>
          ) : (
            <NoSelection noun="file" />
          )
        }
      />
    </>
  );
}
