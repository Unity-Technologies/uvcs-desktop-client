import { ChevronRight } from 'lucide-react';
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { FileListLayoutMenu } from '../../components/FileListLayoutMenu';
import { folderListScope } from '../../components/collapsedFoldersStore';
import { useChangeFilter } from '../../components/useChangeFilter';
import { useFileTree } from '../../components/useFileTree';
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
import { diffEntryTones } from '../diff/diffEntrySources';
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

/**
 * The changes pane of a details panel: what a changeset, branch, label, shelve or code review changed.
 * Selecting an object never runs `cm diff` (it is heavy on big changes and servers): the list loads when asked
 * for, and stays cached, so it shows right away when that object is selected again. Its title hides and shows it again
 * (from the cache, no second `cm diff`), and every panel keeps it hidden, as More details keeps its state, until shown.
 */
export function ChangedFilesSection({ target, branchHead, onOpen }: ChangedFilesSectionProps) {
  const [requested, setRequested] = useState(false);
  const workspacePath = useWorkspacePath();
  const workspaceRepository = useWorkspaceInfo().data?.repository;
  const { changesCollapsed: collapsed, set } = useDetailsLayoutStore();
  const { data: diffEntries, error } = useDiffEntries(target, { enabled: requested, branchHead });
  // The files the diff lists, so the count and the rows match the diff's: no folder added or deleted with its files.
  const entries = useMemo(() => diffEntries && listedEntries(diffEntries), [diffEntries]);
  const { visible, query, bar } = useChangeFilter(entries ?? [], diffEntryKey, diffEntryTones);
  const { rows, tree, toggleCollapsed } = useFileTree(visible, diffEntryKey, folderListScope(workspacePath, `details:${JSON.stringify(target)}`));
  const listed = useMemo(() => firstFilesOf(rows, MAX_LISTED_FILES), [rows]);
  const listRef = useRef<HTMLDivElement>(null);
  // The same menu as in the diff, review marks included, read once the files are asked for or shown from the cache.
  const review = useDiffReview(target, entries ?? NO_ENTRIES, requested || entries !== undefined);
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
      action={view.layoutMenu && <FileListLayoutMenu />}
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
                <ActionContextMenu key={row.key} entries={() => diffEntryMenu(workspacePath, target, row.items, { review, workspaceRepository, diffEntries })}>
                  <button className={styles.file} onClick={() => toggleCollapsed(row.key)} aria-expanded={!row.collapsed} {...ROVING_ITEM}>
                    <DiffEntryRow row={row} tree={tree} />
                  </button>
                </ActionContextMenu>
              ) : (
                <ActionContextMenu key={row.key} entries={() => diffEntryMenu(workspacePath, target, [row.item], { review, workspaceRepository, diffEntries })}>
                  <button className={styles.file} onClick={() => onOpen(row.item.path)} {...ROVING_ITEM}>
                    <DiffEntryRow row={row} tree={tree} />
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

