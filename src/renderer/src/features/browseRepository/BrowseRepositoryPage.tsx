import { useEffect, useState } from 'react';
import type { PageProps } from '../../app/navigation/pages';
import { DetailsToggleButton } from '../../components/DetailsToggleButton';
import { useDetailsPaneStore } from '../../components/detailsPaneStore';
import { FilterBar } from '../../ui/FilterBar';
import { FilterField } from '../../ui/FilterField';
import { ViewHeader } from '../../ui/ViewHeader';
import { browseOpening } from './browseOpening';
import { RepositoryTree } from './RepositoryTree';
import { publishShownBrowseItem } from './shownBrowseItem';

const DETAILS_KEY = 'browseRepositoryTree';

/**
 * The repository as it was at a changeset: read-only, no workspace needed (`RepositoryTree`). Opened on an item
 * (`focusPath`, a link's), its folders open and it's selected; on a file's lines (`focusLines`), the file shows
 * annotated, scrolled to them.
 */
export function BrowseRepositoryPage({ page }: PageProps<'browseRepository'>) {
  const [filter, setFilter] = useState('');
  const [opening] = useState(() => browseOpening(page));
  // What the page's link names (its header, ⇧⌘C): the item selected now, not the one it opened on.
  const publish = (path: string | null): void => publishShownBrowseItem(path === null ? null : { changesetId: page.changesetId, path });
  useEffect(() => () => publishShownBrowseItem(null), []);
  useEffect(() => {
    if (opening.showsDetails) useDetailsPaneStore.getState().showDetails(DETAILS_KEY);
  }, [opening]);

  return (
    <>
      <ViewHeader title={`Repository at changeset ${page.changesetId}`} subtitle="Read-only" detailsToggle={<DetailsToggleButton detailsKey={DETAILS_KEY} />}>
        <FilterBar text={<FilterField value={filter} onChange={setFilter} placeholder="Filter open folders" />} />
      </ViewHeader>
      <RepositoryTree changesetId={page.changesetId} opening={opening} filter={filter} detailsKey={DETAILS_KEY} onShownItem={publish} />
    </>
  );
}
