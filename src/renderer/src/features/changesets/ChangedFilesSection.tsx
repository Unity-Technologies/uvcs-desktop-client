import { ChevronRight } from 'lucide-react';
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { placeId } from '@shared/domain/place';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import { usePlace, usePlaceRepository } from '../../app/workspace/useWorkspace';
import { FileListViewMenu } from '../../components/FileListViewMenu';
import type { FileListViewOffer } from '../../components/fileListViewMenuModel';
import { folderListScope } from '../../components/collapsedFoldersStore';
import { useChangeFilter } from '../../components/useChangeFilter';
import { useFileTree } from '../../components/useFileTree';
import { itemsIn } from '../../lib/itemRange';
import { firstFilesOf, pathTreeKeyMove } from '../../lib/pathTree';
import { moveRovingFocus, ROVING_ITEM } from '../../lib/rovingFocus';
import { DetailsChangesPane } from '../../ui/DetailsChangesPane';
import { useDetailsLayoutStore } from '../../ui/detailsLayoutStore';
import { DetailsEmpty, DetailsSkeleton } from '../../ui/DetailsSection';
import { HighlightQuery } from '../../ui/Highlight';
import { ActionContextMenu } from '../../ui/menu/ActionContextMenu';
import { diffEntryKey } from '../diff/DiffEntryList';
import { diffEntryMenu } from '../diff/diffEntryMenu';
import { listedEntries } from '../diff/listedEntries';
import { pairDiffMetas } from '../diff/diffMetaPairs';
import { DIFF_ENTRY_FACTS, diffEntryTones } from '../diff/diffEntrySources';
import { DiffEntryRow } from '../diff/DiffEntryRow';
import { useDiffReview } from '../diff/review/useDiffReview';
import { useDiffEntries } from '../diff/useDiffEntries';
import { changedFilesView } from './changedFilesView';
import styles from './ChangedFilesSection.module.css';

const MAX_LISTED_FILES = 300;

const NO_ENTRIES: DiffEntry[] = [];

interface ChangedFilesSectionProps {
  target: DiffTarget;
  /** For a branch, its head: the list is reused until the branch moves. */
  branchHead?: number;
  /** Opens the full diff, focused on the file. */
  onOpen: (focusPath: string) => void;
}

/** A details panel's short list is never grouped: its view menu offers the layout and the order. */
const NO_GROUPINGS: FileListViewOffer = { statusGroups: false };

/**
 * The changes pane of a details panel: what a changeset, branch, label, shelve or code review changed.
 * Selecting an object never runs `cm diff` (it is heavy on big changes and servers): the list loads when asked
 * for, and stays cached, so it shows right away when that object is selected again. Its title hides and shows it again
 * (from the cache, no second `cm diff`), and every panel keeps it hidden, as More details keeps its state, until shown.
 */
export function ChangedFilesSection({ target, branchHead, onOpen }: ChangedFilesSectionProps) {
  const [requested, setRequested] = useState(false);
  const place = usePlace();
  const workspaceRepository = usePlaceRepository();
  const { changesCollapsed: collapsed, set } = useDetailsLayoutStore();
  const { data: diffEntries, error } = useDiffEntries(target, { enabled: requested, branchHead });
  // The files the diff lists, so the count and the rows match the diff's: no folder added or deleted with its files, and
  // a Unity asset's `.meta` on its asset's row (`pairDiffMetas`).
  const pairs = useMemo(() => diffEntries && pairDiffMetas(listedEntries(diffEntries)), [diffEntries]);
  const entries = pairs?.shown;
  const metaOf = (entry: DiffEntry) => pairs?.metaOf(entry);
  // "Open .meta diff" opens the diff on the meta, which shows it on its asset's row (`pairedFocus`).
  const { visible, query, bar } = useChangeFilter(entries ?? [], diffEntryKey, diffEntryTones, { viewOffer: NO_GROUPINGS });
  const { rows, tree, toggleCollapsed } = useFileTree(visible, entries ?? NO_ENTRIES, diffEntryKey, folderListScope(placeId(place), `details:${JSON.stringify(target)}`), DIFF_ENTRY_FACTS);
  const listed = useMemo(() => firstFilesOf(rows, MAX_LISTED_FILES), [rows]);
  const listRef = useRef<HTMLDivElement>(null);
  // The same menu as in the diff, review marks included, read once the files are asked for or shown from the cache.
  const review = useDiffReview(target, entries ?? NO_ENTRIES, requested || entries !== undefined);
  const menuOptions = { review, workspaceRepository, diffEntries, metaOf, onMetaDiff: (meta: DiffEntry) => onOpen(meta.path) };
  const view = changedFilesView({ listedCount: entries?.length, matchingCount: visible.length, requested, failed: Boolean(error), collapsed });

  const onListKeyDown = (event: KeyboardEvent): void => {
    const list = listRef.current;
    if (!list) return;
    const buttons = [...list.querySelectorAll<HTMLElement>('[data-roving-item]')];
    const index = buttons.findIndex((button) => button === document.activeElement);
    const move = index === -1 ? null : pathTreeKeyMove(listed.rows, index, event.key);
    if (move?.kind === 'toggle' && event.key !== 'Enter') {
      event.preventDefault();
      toggleCollapsed(listed.rows[index]!.key);
    } else if (move?.kind === 'moveBy') {
      event.preventDefault();
      buttons[index + move.step]?.focus();
    } else {
      moveRovingFocus(list, event);
    }
  };

  return (
    // No "Open diff" here: the panel's primary action at the top opens it.
    <DetailsChangesPane
      title={view.title}
      action={view.layoutMenu && <FileListViewMenu offer={NO_GROUPINGS} />}
      expanded={view.expanded}
      disclosure={view.collapsible ? { open: !collapsed, toggle: () => set({ changesCollapsed: !collapsed }) } : undefined}
    >
      <div className={styles.content}>
        {view.offersToShow && (
          <button
            className={styles.show}
            onClick={() => {
              setRequested(true);
              set({ changesCollapsed: false });
            }}
          >
            <ChevronRight size={14} />
            Show changed files
          </button>
        )}
        {error && <DetailsEmpty>{error.message}</DetailsEmpty>}
        {view.loading && <DetailsSkeleton />}
        {view.noChanges && <DetailsEmpty>No file changes.</DetailsEmpty>}
        {view.filters && <div className={styles.filter}>{bar}</div>}
        {view.noMatches && <DetailsEmpty>No files match the filter.</DetailsEmpty>}
      </div>
      {view.listsFiles && (
        <HighlightQuery query={query}>
          <div ref={listRef} className={styles.files} onKeyDown={onListKeyDown}>
            {listed.rows.map((row) =>
              row.type === 'folder' ? (
                <ActionContextMenu key={row.key} entries={() => diffEntryMenu(place, target, itemsIn(row.held), menuOptions)}>
                  <button className={styles.file} onClick={() => toggleCollapsed(row.key)} aria-expanded={!row.collapsed} {...ROVING_ITEM}>
                    <DiffEntryRow row={row} tree={tree} />
                  </button>
                </ActionContextMenu>
              ) : (
                <ActionContextMenu key={row.key} entries={() => diffEntryMenu(place, target, [row.item], menuOptions)}>
                  <button className={styles.file} onClick={() => onOpen(row.item.path)} {...ROVING_ITEM}>
                    <DiffEntryRow row={row} tree={tree} hasMeta={metaOf(row.item) !== undefined} />
                  </button>
                </ActionContextMenu>
              ),
            )}
            {listed.unlistedFiles > 0 && <DetailsEmpty>And {listed.unlistedFiles} more — open the diff to see them all.</DetailsEmpty>}
          </div>
        </HighlightQuery>
      )}
    </DetailsChangesPane>
  );
}

