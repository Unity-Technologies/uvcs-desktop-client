import { FolderTree } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import type { PageProps } from '../../app/navigation/pages';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { EMPTY_SELECTION, type SelectionState } from '../../lib/selection';
import { useSettledValue } from '../../lib/useSettled';
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
  // The field shows each keystroke at once; tens of thousands of open rows are filtered right after.
  const shownFilter = useDeferredValue(filter);
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);

  const { childrenByDirectory, isLoadingRoot, error } = useTreeListings(
    (directory) => queryKeys.inWorkspace(workspacePath, 'explorer', 'repositoryDirectory', page.changesetId, directory),
    (directory) => api.explorer.listRepositoryDirectory(workspacePath, page.changesetId, directory),
    expanded,
  );
  const rows = useMemo(() => buildFileTreeRows({ childrenByDirectory, expanded, filter: shownFilter }), [childrenByDirectory, expanded, shownFilter]);
  const focused = rows.find((row) => row.item.path === selection.anchor)?.item;
  // Arrowing through the tree doesn't read (`cm cat`) the revisions of every file it passes.
  const shownItem = useSettledValue(focused, focused?.path ?? '');

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
        initialSize={700}
        minSize={380}
        maxSize={1100}
        first={
          <HighlightQuery query={shownFilter}>
            <FileTreeTable
              rows={rows}
              selection={selection}
              onSelectionChange={setSelection}
              onToggleDirectory={(directory) => toggle(treeId, directory)}
              onOpenFile={(item) => openRevision(workspacePath, item)}
              contextMenu={(items) => revisionMenu(workspacePath, page.changesetId, items)}
            />
          </HighlightQuery>
        }
        second={
          shownItem ? (
            <RevisionChanges workspacePath={workspacePath} item={shownItem} />
          ) : (
            <EmptyState icon={<FolderTree size={22} />} title="Select a file" description="See what its revision changed." />
          )
        }
      />
    </>
  );
}
