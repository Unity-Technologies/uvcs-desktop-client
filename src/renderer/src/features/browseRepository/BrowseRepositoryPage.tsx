import { Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { repositoryPlace } from '@shared/domain/place';
import type { PageProps } from '../../app/navigation/pages';
import { usePlaceRepository } from '../../app/workspace/useWorkspace';
import { DetailsToggleButton } from '../../components/DetailsToggleButton';
import { useDetailsPaneStore } from '../../components/detailsPaneStore';
import { hotkey } from '../../lib/shortcutRegistry';
import { useShortcut } from '../../lib/useShortcut';
import { FilterBar } from '../../ui/FilterBar';
import { FilterField } from '../../ui/FilterField';
import { IconButton } from '../../ui/IconButton';
import { Stowable } from '../../ui/Stowable';
import { ViewHeader } from '../../ui/ViewHeader';
import { useDiffExpanded } from '../../components/diffExpansionStore';
import { GO_TO_FILE_SHORTCUT } from '../files/useFileCommands';
import { goToRepositoryFile } from '../repositoryFiles/RepositoryGoToFileDialog';
import { useGoToFileCommand } from '../repositoryFiles/useGoToFileCommand';
import { browseOpening } from './browseOpening';
import { RepositoryTree } from './RepositoryTree';
import { publishShownBrowseItem } from './shownBrowseItem';

const DETAILS_KEY = 'browseRepositoryTree';

/**
 * The repository as it was at a changeset: read-only, no workspace needed (`RepositoryTree`). Opened on an item
 * (`focusPath`, a link's), its folders open and it's selected; on a file's lines (`focusLines`), the file shows
 * annotated, scrolled to them. Go to file finds an item of the changeset by name, as Files does, and reveals it.
 */
export function BrowseRepositoryPage({ page }: PageProps<'browseRepository'>) {
  const [filter, setFilter] = useState('');
  const [opening, setOpening] = useState(() => browseOpening(page));
  // The tree reads its opening once, as it mounts: each pick of Go to file mounts it again on the item picked.
  const [reveals, setReveals] = useState(0);
  const diffExpanded = useDiffExpanded();
  const repository = usePlaceRepository();
  // What the page's link names (its header, ⇧⌘C): the item selected now, not the one it opened on.
  const publish = (path: string | null): void => publishShownBrowseItem(path === null ? null : { changesetId: page.changesetId, path });
  useEffect(() => () => publishShownBrowseItem(null), []);
  useEffect(() => {
    if (opening.showsDetails) useDetailsPaneStore.getState().showDetails(DETAILS_KEY);
  }, [opening]);

  // Lists the changeset's whole tree only once the dialog opens, as Files' Go to file does.
  const searchPlace = useMemo(() => (repository ? repositoryPlace(repository) : null), [repository]);
  const openGoToFile = useCallback(() => {
    if (!searchPlace) return;
    void goToRepositoryFile({ place: searchPlace, changesetId: page.changesetId, scope: { kind: 'changeset', changeset: page.changesetId } }).then((path) => {
      if (!path) return;
      setOpening(browseOpening({ focusPath: path }));
      setReveals((count) => count + 1);
    });
  }, [searchPlace, page.changesetId]);
  useGoToFileCommand(searchPlace ? openGoToFile : null);
  useShortcut(hotkey('filesGoToFile'), openGoToFile, searchPlace !== null);

  return (
    <>
      <Stowable stowed={diffExpanded}>
        <ViewHeader
          title={`Repository at changeset ${page.changesetId}`}
          subtitle="Read-only"
          actions={<IconButton icon={<Search size={14} />} label="Go to file" shortcut={GO_TO_FILE_SHORTCUT} disabled={!searchPlace} onClick={openGoToFile} />}
          detailsToggle={<DetailsToggleButton detailsKey={DETAILS_KEY} />}
        >
          <FilterBar text={<FilterField value={filter} onChange={setFilter} placeholder="Filter open folders" />} />
        </ViewHeader>
      </Stowable>
      <RepositoryTree
        key={reveals}
        changesetId={page.changesetId}
        opening={opening}
        filter={filter}
        detailsKey={DETAILS_KEY}
        onShownItem={publish}
        onGoToFile={openGoToFile}
      />
    </>
  );
}
