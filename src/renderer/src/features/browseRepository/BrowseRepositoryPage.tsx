import { useDeferredValue, useMemo, useState } from 'react';
import type { PageProps } from '../../app/navigation/pages';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { ListWithDetails } from '../../components/ListWithDetails';
import { NoSelection } from '../../components/NoSelection';
import { EMPTY_SELECTION, singleSelection, type SelectionState } from '../../lib/selection';
import { EmptyState } from '../../ui/EmptyState';
import { HighlightQuery } from '../../ui/Highlight';
import { FilterBar } from '../../ui/FilterBar';
import { FilterField } from '../../ui/FilterField';
import { CenteredSpinner } from '../../ui/Spinner';
import { ViewHeader } from '../../ui/ViewHeader';
import { useExpandedDirectories, useExpandedDirectoriesStore } from '../files/expandedDirectoriesStore';
import { FileTreeTable } from '../files/FileTreeTable';
import { FILE_TREE_WIDTH } from '../files/fileTreeWidth';
import { buildFileTreeRows } from '../files/fileTreeRows';
import { ItemDetailsPane } from '../files/ItemDetailsPane';
import { useTreeListings } from '../files/useTreeListings';
import { repositoryListingQuery } from './repositoryListing';
import { openRevision, revisionMenu } from './revisionMenu';

/** The repository as it was at a changeset: read-only, no workspace needed. */
export function BrowseRepositoryPage({ page }: PageProps<'browseRepository'>) {
  const workspacePath = useWorkspacePath();
  const repository = useWorkspaceInfo().data?.repository;
  const treeId = `${workspacePath}#cs:${page.changesetId}`;
  const expanded = useExpandedDirectories(treeId);
  const toggle = useExpandedDirectoriesStore((state) => state.toggle);
  const [filter, setFilter] = useState('');
  // The field shows each keystroke at once; tens of thousands of open rows are filtered right after.
  const shownFilter = useDeferredValue(filter);
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);

  const { childrenByDirectory, isLoadingRoot, error } = useTreeListings((directory) => repositoryListingQuery(workspacePath, page.changesetId, directory), expanded);
  const rows = useMemo(() => buildFileTreeRows({ childrenByDirectory, expanded, filter: shownFilter }), [childrenByDirectory, expanded, shownFilter]);
  const focused = rows.find((row) => row.item.path === selection.anchor)?.item;
  const [revealPath, setRevealPath] = useState<string | null>(null);
  const selectFolder = (path: string): void => {
    setSelection(singleSelection(path));
    setRevealPath(path);
  };

  const header = (
    <ViewHeader title={`Repository at changeset ${page.changesetId}`} subtitle="Read-only">
      <FilterBar text={<FilterField value={filter} onChange={setFilter} placeholder="Filter open folders" />} />
    </ViewHeader>
  );

  if (isLoadingRoot) return <>{header}<CenteredSpinner /></>;
  if (error) return <>{header}<EmptyState title="Couldn't browse the repository" description={error.message} /></>;

  return (
    <>
      {header}
      <ListWithDetails
        widthKey="browseRepositoryTree"
        widthLimits={FILE_TREE_WIDTH}
        sized="list"
        list={
          <HighlightQuery query={shownFilter}>
            <FileTreeTable
              rows={rows}
              selection={selection}
              onSelectionChange={setSelection}
              onToggleDirectory={(directory) => toggle(treeId, directory)}
              onOpenFile={(item) => openRevision(workspacePath, item)}
              contextMenu={(items) => revisionMenu(workspacePath, page.changesetId, repository, items)}
              revealPath={revealPath}
            />
          </HighlightQuery>
        }
        details={
          focused ? (
            <ItemDetailsPane
              workspacePath={workspacePath}
              item={focused}
              menu={revisionMenu(workspacePath, page.changesetId, repository, [focused])}
              onSelectFolder={selectFolder}
              folderContents={childrenByDirectory.get(focused.path)}
            />
          ) : (
            <NoSelection noun="file" />
          )
        }
      />
    </>
  );
}
