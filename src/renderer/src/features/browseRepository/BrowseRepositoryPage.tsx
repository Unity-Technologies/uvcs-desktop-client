import { useEffect, useMemo, useState } from 'react';
import { repositoryPlace } from '@shared/domain/place';
import type { PageProps } from '../../app/navigation/pages';
import { usePlaceRepository } from '../../app/workspace/useWorkspace';
import { DetailsToggleButton } from '../../components/DetailsToggleButton';
import { useDetailsPaneStore } from '../../components/detailsPaneStore';
import { FilterBar } from '../../ui/FilterBar';
import { Stowable } from '../../ui/Stowable';
import { ViewHeader } from '../../ui/ViewHeader';
import { useDiffExpanded } from '../../components/diffExpansionStore';
import { RepositoryTreeSearchField, RepositoryTreeSearchResults } from '../repositoryFiles/RepositoryTreeSearch';
import { useRepositoryTreeSearch } from '../repositoryFiles/useRepositoryTreeSearch';
import { browseOpening } from './browseOpening';
import { RepositoryTree } from './RepositoryTree';
import { publishShownBrowseItem } from './shownBrowseItem';

const DETAILS_KEY = 'browseRepositoryTree';

/**
 * The repository as it was at a changeset: read-only, no workspace needed (`RepositoryTree`). Opened on an item
 * (`focusPath`, a link's), its folders open and it's selected; on a file's lines (`focusLines`), the file shows
 * annotated, scrolled to them. The search above the tree finds an item anywhere in the changeset by name, as Files'
 * does, and reveals it.
 */
export function BrowseRepositoryPage({ page }: PageProps<'browseRepository'>) {
  const [opening, setOpening] = useState(() => browseOpening(page));
  // The tree reads its opening once, as it mounts: each pick of the search mounts it again on the item picked.
  const [reveals, setReveals] = useState(0);
  const diffExpanded = useDiffExpanded();
  const repository = usePlaceRepository();
  // What the page's link names (its header, ⇧⌘C): the item selected now, not the one it opened on.
  const publish = (path: string | null): void => publishShownBrowseItem(path === null ? null : { changesetId: page.changesetId, path });
  useEffect(() => () => publishShownBrowseItem(null), []);
  useEffect(() => {
    if (opening.showsDetails) useDetailsPaneStore.getState().showDetails(DETAILS_KEY);
  }, [opening]);

  // Waits while the repository isn't known yet (a workspace's info still reading): there's nothing to search.
  const searchPlace = useMemo(() => repositoryPlace(repository ?? ''), [repository]);
  const search = useRepositoryTreeSearch({
    place: searchPlace,
    changesetId: repository ? page.changesetId : null,
    name: `changeset ${page.changesetId}`,
    onReveal: (path) => {
      setOpening(browseOpening({ focusPath: path }));
      setReveals((count) => count + 1);
    },
  });

  return (
    <>
      <Stowable stowed={diffExpanded}>
        <ViewHeader
          title={`Repository at changeset ${page.changesetId}`}
          subtitle="Read-only"
          detailsToggle={<DetailsToggleButton detailsKey={DETAILS_KEY} />}
        >
          <FilterBar text={<RepositoryTreeSearchField search={search} />} />
        </ViewHeader>
      </Stowable>
      <RepositoryTree
        key={reveals}
        changesetId={page.changesetId}
        opening={opening}
        search={search.searching ? <RepositoryTreeSearchResults search={search} /> : undefined}
        detailsKey={DETAILS_KEY}
        onShownItem={publish}
        onGoToFile={search.focus}
      />
    </>
  );
}
