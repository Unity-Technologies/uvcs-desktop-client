import { FolderTree } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import type { PageProps } from '../../app/navigation/pages';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { EMPTY_SELECTION, type SelectionState } from '../../lib/selection';
import { EmptyState } from '../../ui/EmptyState';
import { HighlightQuery } from '../../ui/Highlight';
import { SearchField } from '../../ui/SearchField';
import { CenteredSpinner } from '../../ui/Spinner';
import { SplitPane } from '../../ui/SplitPane';
import { ViewHeader } from '../../ui/ViewHeader';
import { useExpandedDirectories, useExpandedDirectoriesStore } from '../files/expandedDirectoriesStore';
import { FileTreeTable } from '../files/FileTreeTable';
import { buildFileTreeRows } from '../files/fileTreeRows';
import { RevisionChanges } from '../files/RevisionChanges';
import { useTreeListings } from '../files/useTreeListings';
import { openRevision, revisionMenu } from './revisionMenu';

/** The repository as it was at a changeset: read-only, no workspace needed. */
export function BrowseRepositoryPage({ page }: PageProps<'browseRepository'>) {
  const workspacePath = useWorkspacePath();
  const treeId = `${workspacePath}#cs:${page.changesetId}`;
  const expanded = useExpandedDirectories(treeId);
  const toggle = useExpandedDirectoriesStore((state) => state.toggle);
  const [filter, setFilter] = useState('');
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);

  const { childrenByDirectory, isLoadingRoot, error } = useTreeListings(
    (directory) => queryKeys.inWorkspace(workspacePath, 'explorer', 'repositoryDirectory', page.changesetId, directory),
    (directory) => api.explorer.listRepositoryDirectory(workspacePath, page.changesetId, directory),
    expanded,
  );
  const rows = useMemo(() => buildFileTreeRows({ childrenByDirectory, expanded, filter }), [childrenByDirectory, expanded, filter]);
  const focused = rows.find((row) => row.item.path === selection.anchor)?.item;

  const header = (
    <ViewHeader title={`Repository at changeset ${page.changesetId}`} subtitle="Read-only">
      <SearchField value={filter} onChange={setFilter} placeholder="Filter open folders" />
    </ViewHeader>
  );

  if (isLoadingRoot) return <>{header}<CenteredSpinner /></>;
  if (error) return <>{header}<EmptyState title="Couldn't browse the repository" description={error.message} /></>;

  return (
    <>
      {header}
      <SplitPane
        initialSize={620}
        minSize={380}
        maxSize={1100}
        first={
          <HighlightQuery query={filter}>
            <FileTreeTable
              rows={rows}
              selection={selection}
              onSelectionChange={setSelection}
              onToggleDirectory={(directory) => toggle(treeId, directory)}
              onOpenFile={(item) => openRevision(workspacePath, item)}
              contextMenu={(items) => revisionMenu(workspacePath, items)}
            />
          </HighlightQuery>
        }
        second={
          focused ? (
            <RevisionChanges workspacePath={workspacePath} item={focused} />
          ) : (
            <EmptyState icon={<FolderTree size={22} />} title="Select a file" description="See what its revision changed." />
          )
        }
      />
    </>
  );
}
