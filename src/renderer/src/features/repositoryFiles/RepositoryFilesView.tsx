import { useEffect, useMemo, useState } from 'react';
import type { RepositoryPlace } from '@shared/domain/place';
import { placeId } from '@shared/domain/place';
import { DetailsToggleButton } from '../../components/DetailsToggleButton';
import { ViewRefreshButton } from '../../components/ViewRefreshButton';
import { EmptyState } from '../../ui/EmptyState';
import { FilterBar } from '../../ui/FilterBar';
import { ViewHeader } from '../../ui/ViewHeader';
import { Stowable } from '../../ui/Stowable';
import { useDiffExpanded } from '../../components/diffExpansionStore';
import { useBranch } from '../branches/useBranches';
import { browseOpening } from '../browseRepository/browseOpening';
import { RepositoryTree, RepositoryTreeSkeleton } from '../browseRepository/RepositoryTree';
import { useFilesViewStore, useRevealRequest } from '../files/filesViewStore';
import { FilesBranchPicker } from './FilesBranchPicker';
import { RepositoryTreeSearchField, RepositoryTreeSearchResults } from './RepositoryTreeSearch';
import { useRepositoryTreeSearch } from './useRepositoryTreeSearch';
import { useRepositoryFilesStore } from './repositoryFilesStore';
import { branchFilesOrigin, filesBranchCaption, filesBranchToRead, repositoryFilesBodyOf } from './repositoryFilesBody';

const DETAILS_KEY = 'repositoryFilesTree';

/**
 * Files in a repository explored without a workspace (docs/features/explore-repository.md "Files"): the latest tree of
 * a branch, the main branch's until another is picked (`FilesBranchPicker`), as Browse repository shows a changeset's
 * (`RepositoryTree`). It reads that branch alone (`filesBranchToRead`), and shows what `repositoryFilesBodyOf` says.
 * Another branch keeps the item selected, when it has it; a path asked for (a link's, `requestReveal`) opens its
 * folders and is selected; the folders open are the branch's, kept as its head moves.
 */
export function RepositoryFilesView({ place }: { place: RepositoryPlace }) {
  const { repository } = place;
  const chosen = useRepositoryFilesStore((state) => state.chosenBranches[repository]);
  const { choose, forget } = useRepositoryFilesStore.getState();
  const branchRead = useBranch(filesBranchToRead(chosen));
  const body = repositoryFilesBodyOf({ data: branchRead.data, error: branchRead.error }, chosen);
  const diffExpanded = useDiffExpanded();
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
  useEffect(() => {
    if (body.kind === 'chosenGone') forget(repository);
  }, [body.kind, repository]);

  const shown = body.kind === 'tree' ? body.branch : null;
  // One object per branch head: the links' hook keys its own memo by it.
  const linkOrigin = useMemo(() => (shown ? branchFilesOrigin(repository, shown) : undefined), [repository, shown?.name, shown?.headChangeset]);
  // Finds a file or folder anywhere in the branch's latest tree by name, revealed in the tree once picked.
  const search = useRepositoryTreeSearch({
    place,
    changesetId: shown?.headChangeset ?? null,
    name: shown?.name ?? '',
    onReveal: (path) => useFilesViewStore.getState().requestReveal(place, path),
  });

  const header = (
    <ViewHeader
      title="Files"
      detailsToggle={<DetailsToggleButton detailsKey={DETAILS_KEY} />}
      subtitle={shown ? filesBranchCaption(shown) : undefined}
      actions={
        <ViewRefreshButton fetching={branchRead.isFetching} />
      }
    >
      <FilterBar
        text={<RepositoryTreeSearchField search={search} />}
        kinds={<FilesBranchPicker shown={shown?.name ?? null} onPick={(picked) => choose(repository, { name: picked.name, guid: picked.guid })} />}
      />
    </ViewHeader>
  );

  return (
    <>
      <Stowable stowed={diffExpanded}>{header}</Stowable>
      {body.kind === 'error' && <EmptyState title="Couldn't read the branch" description={body.message} />}
      {body.kind === 'pickBranch' && <EmptyState title="No /main branch" description="Pick the branch whose latest files to show." />}
      {(body.kind === 'loading' || body.kind === 'chosenGone') && <RepositoryTreeSkeleton detailsKey={DETAILS_KEY} />}
      {body.kind === 'tree' && (
        <RepositoryTree
          // A branch's latest tree is another changeset's: its tree starts anew, on the item selected before.
          key={`${body.branch.headChangeset}:${reveals}`}
          changesetId={body.branch.headChangeset}
          treeId={`${placeId(place)}#branch:${body.branch.guid}`}
          opening={browseOpening({ focusPath: shownPath ?? undefined })}
          search={search.searching ? <RepositoryTreeSearchResults search={search} /> : undefined}
          detailsKey={DETAILS_KEY}
          onShownItem={setShownPath}
          linkOrigin={linkOrigin}
          onGoToFile={search.focus}
        />
      )}
    </>
  );
}
