import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { placeId } from '@shared/domain/place';
import { revisionRef } from '@shared/domain/revision';
import { usePlace, usePlaceRepository } from '../../app/workspace/useWorkspace';
import { ListWithDetails } from '../../components/ListWithDetails';
import { NoSelection } from '../../components/NoSelection';
import { EMPTY_SELECTION, singleSelection, type SelectionState } from '../../lib/selection';
import { DetailsPanelSkeleton } from '../../ui/DetailsPanelSkeleton';
import { EmptyState } from '../../ui/EmptyState';
import { HighlightQuery } from '../../ui/Highlight';
import type { FileView } from '../annotate/fileView';
import { LineLinksContext, type LineLinks } from '../diff/viewer/lineLinks';
import { useFocusUntilMoved } from '../diff/viewer/useFocusUntilMoved';
import { useExpandedDirectories, useExpandedDirectoriesStore } from '../files/expandedDirectoriesStore';
import { buildFileTreeRows } from '../files/fileTreeRows';
import { FileTreeSkeleton, FileTreeTable } from '../files/FileTreeTable';
import { FILE_TREE_WIDTH } from '../files/fileTreeWidth';
import { ItemDetailsPane } from '../files/ItemDetailsPane';
import { useFilesItemLinks } from '../files/useFilesItemLinks';
import { useTreeListings } from '../files/useTreeListings';
import { openRevision } from '../history/revisionOperations';
import type { BrowseOpening } from './browseOpening';
import { repositoryListingQuery } from './repositoryListing';
import { revisionMenu } from './revisionMenu';

interface RepositoryTreeProps {
  /** The changeset whose tree it shows; every listing of it is read once, and kept (`repositoryListingQuery`). */
  changesetId: number;
  /** What it opens on: an item selected, its folders open, the lines a link names (`browseOpening`). */
  opening: BrowseOpening;
  /** Filters the open folders' rows. */
  filter: string;
  /** Where the tree's width and whether its details are hidden are kept, one per place it shows in. */
  detailsKey: string;
  /** The item selected now, for the link its host copies (Browse repository's page). */
  onShownItem?: (path: string | null) => void;
  /** Whose folders open stay open: this changeset's by default; a branch's in Files, so a new head keeps them. */
  treeId?: string;
  /**
   * Where the files come from, for their item and line links (`useFilesItemLinks`): a branch's latest in Files. None
   * in Browse repository, whose page names the lines.
   */
  linkOrigin?: Parameters<typeof useFilesItemLinks>[0];
  /** Opens Go to file from the tree's keys, as a workspace's tree does (Files' `goToRepositoryFile`). */
  onGoToFile?: () => void;
}

/**
 * The repository's tree at a changeset, read-only, with the selected item's details: Browse repository's page, and
 * the Files view of a repository explored without a workspace (`RepositoryFilesView`). Folders are listed as they
 * open, each once (`cm ls` of that folder at the changeset).
 */
export function RepositoryTree({ changesetId, opening, filter, detailsKey, onShownItem, treeId: ownTreeId, linkOrigin, onGoToFile }: RepositoryTreeProps) {
  const place = usePlace();
  const repository = usePlaceRepository();
  const treeId = ownTreeId ?? `${placeId(place)}#cs:${changesetId}`;
  const expanded = useExpandedDirectories(treeId);
  const toggle = useExpandedDirectoriesStore((state) => state.toggle);
  // The field shows each keystroke at once; tens of thousands of open rows are filtered right after.
  const shownFilter = useDeferredValue(filter);
  const [selection, setSelection] = useState<SelectionState>(() => (opening.selected ? singleSelection(opening.selected) : EMPTY_SELECTION));
  const linkFocus = useFocusUntilMoved(opening.focus, selection.anchor ?? undefined);
  const [ownFileView, setOwnFileView] = useState<FileView | null>(opening.fileView);
  const fileViewChoice = useMemo(() => (ownFileView ? { fileView: ownFileView, setFileView: setOwnFileView } : undefined), [ownFileView]);
  useEffect(() => {
    if (opening.expand.length > 0) useExpandedDirectoriesStore.getState().expand(treeId, opening.expand);
  }, []);

  const { childrenByDirectory, isLoadingRoot, error } = useTreeListings((directory) => repositoryListingQuery(place, changesetId, directory), expanded);
  const rows = useMemo(() => buildFileTreeRows({ childrenByDirectory, expanded, filter: shownFilter }), [childrenByDirectory, expanded, shownFilter]);
  const focused = rows.find((row) => row.item.path === selection.anchor)?.item;
  const itemLinks = useFilesItemLinks(linkOrigin, focused);
  const lineLinks = useMemo<LineLinks>(() => (linkOrigin ? { ...itemLinks, focus: linkFocus } : { focus: linkFocus, publishes: true }), [linkOrigin, itemLinks, linkFocus]);
  useEffect(() => onShownItem?.(focused?.path ?? null), [focused?.path]);
  const [revealPath, setRevealPath] = useState<string | null>(opening.selected);
  const selectFolder = (path: string): void => {
    setSelection(singleSelection(path));
    setRevealPath(path);
  };

  if (error) return <EmptyState title="Couldn't browse the repository" description={error.message} />;
  if (isLoadingRoot) return <RepositoryTreeSkeleton detailsKey={detailsKey} />;

  return (
    <ListWithDetails
      detailsKey={detailsKey}
      widthLimits={FILE_TREE_WIDTH}
      sized="list"
      list={
          <HighlightQuery query={shownFilter}>
            <FileTreeTable
              rows={rows}
              selection={selection}
              onSelectionChange={setSelection}
              onToggleDirectory={(directory) => toggle(treeId, directory)}
              onOpenFile={(item) => void openRevision(place, revisionRef(item), item.name)}
              contextMenu={(items) => revisionMenu(place, changesetId, repository, items)}
              revealPath={revealPath}
              onGoToFile={onGoToFile}
            />
          </HighlightQuery>
      }
      details={
        focused ? (
          <LineLinksContext.Provider value={lineLinks}>
            <ItemDetailsPane
              place={place}
              item={focused}
              menu={revisionMenu(place, changesetId, repository, [focused])}
              onSelectFolder={selectFolder}
              listings={childrenByDirectory}
              fileViewChoice={fileViewChoice}
            />
          </LineLinksContext.Provider>
        ) : (
          <NoSelection noun="file" />
        )
      }
    />
  );
}

/** The tree's own header over placeholder rows, and the details' placeholder, while its root is read: the layout never changes shape. */
export function RepositoryTreeSkeleton({ detailsKey }: { detailsKey: string }) {
  return <ListWithDetails detailsKey={detailsKey} widthLimits={FILE_TREE_WIDTH} sized="list" list={<FileTreeSkeleton />} details={<DetailsPanelSkeleton />} />;
}
