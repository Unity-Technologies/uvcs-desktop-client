import { useEffect, useState } from 'react';
import { usePlace, usePlaceRepository } from '../../app/workspace/useWorkspace';
import { ListWithDetails } from '../../components/ListWithDetails';
import { ViewRefreshButton } from '../../components/ViewRefreshButton';
import { DetailsPanelSkeleton } from '../../ui/DetailsPanelSkeleton';
import { EmptyState } from '../../ui/EmptyState';
import { FilterBar } from '../../ui/FilterBar';
import { FilterField } from '../../ui/FilterField';
import { ViewHeader } from '../../ui/ViewHeader';
import { useBranches } from '../branches/useBranches';
import { browseOpening } from '../browseRepository/browseOpening';
import { RepositoryTree } from '../browseRepository/RepositoryTree';
import { FileTreeSkeleton } from '../files/FileTreeTable';
import { useFilesViewStore, useRevealRequest } from '../files/filesViewStore';
import { FILE_TREE_WIDTH } from '../files/fileTreeWidth';
import { FilesBranchPicker } from './FilesBranchPicker';
import { useRepositoryFilesStore } from './repositoryFilesStore';
import { filesBranchCaption, shownFilesBranch } from './shownFilesBranch';

const WIDTH_KEY = 'repositoryFilesTree';

/**
 * Files in a repository explored without a workspace (docs/features/explore-repository.md): the latest tree of a
 * branch, the main branch's until another is picked (`shownFilesBranch`, `FilesBranchPicker`), as Browse repository
 * shows a changeset's (`RepositoryTree`). Another branch keeps the item selected, when it has it; a path asked for (a
 * link's, `requestReveal`) opens its folders and is selected.
 */
export function RepositoryFilesView() {
  const place = usePlace();
  const repository = usePlaceRepository() ?? '';
  const branchesQuery = useBranches();
  const chosen = useRepositoryFilesStore((state) => state.chosenBranches[repository]);
  const choose = useRepositoryFilesStore((state) => state.choose);
  const branch = shownFilesBranch(branchesQuery.data, chosen);
  const [filter, setFilter] = useState('');
  const [shownPath, setShownPath] = useState<string | null>(null);
  // A reveal opens the tree anew on its path: the tree reads where it opens only as it mounts.
  const [reveals, setReveals] = useState(0);
  const revealRequest = useRevealRequest(place);
  useEffect(() => {
    if (!revealRequest) return;
    setShownPath(revealRequest.path);
    setReveals((count) => count + 1);
    useFilesViewStore.getState().revealed(revealRequest);
  }, [revealRequest]);

  const header = (
    <ViewHeader
      title="Files"
      subtitle={branch ? filesBranchCaption(branch) : undefined}
      actions={<ViewRefreshButton fetching={branchesQuery.isFetching} />}
    >
      <FilterBar
        text={<FilterField value={filter} onChange={setFilter} placeholder="Filter open folders" />}
        kinds={branch && <FilesBranchPicker shown={branch} onPick={(picked) => choose(repository, picked.name)} />}
      />
    </ViewHeader>
  );

  if (branchesQuery.error && !branch) return <>{header}<EmptyState title="Couldn't read the branches" description={branchesQuery.error.message} /></>;
  if (branchesQuery.data && !branch) return <>{header}<EmptyState title="No branches yet" description="The repository has nothing checked in." /></>;

  return (
    <>
      {header}
      {branch ? (
        <RepositoryTree
          // A branch's latest tree is another changeset's: its tree starts anew, on the item selected before.
          key={`${branch.headChangeset}:${reveals}`}
          changesetId={branch.headChangeset}
          opening={browseOpening({ focusPath: shownPath ?? undefined })}
          filter={filter}
          widthKey={WIDTH_KEY}
          onShownItem={setShownPath}
        />
      ) : (
        <ListWithDetails widthKey={WIDTH_KEY} widthLimits={FILE_TREE_WIDTH} sized="list" list={<FileTreeSkeleton />} details={<DetailsPanelSkeleton />} />
      )}
    </>
  );
}
