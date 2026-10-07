import { ChevronRight } from 'lucide-react';
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { FileListLayoutMenu } from '../../components/FileListLayoutMenu';
import { useChangeFilter } from '../../components/useChangeFilter';
import { useFileTree } from '../../components/useFileTree';
import { firstFilesOf, pathTreeKeyMove } from '../../lib/pathTree';
import { moveRovingFocus, ROVING_ITEM } from '../../lib/rovingFocus';
import { pluralize } from '../../lib/text';
import { DetailsChangesPane } from '../../ui/DetailsChangesPane';
import { useDetailsLayoutStore } from '../../ui/detailsLayoutStore';
import { DetailsEmpty, DetailsSkeleton } from '../../ui/DetailsSection';
import { HighlightQuery } from '../../ui/Highlight';
import { ActionContextMenu } from '../../ui/menu/ActionContextMenu';
import { diffEntryKey } from '../diff/DiffEntryList';
import { diffEntryMenu } from '../diff/diffEntryMenu';
import { diffEntryTones } from '../diff/diffEntrySources';
import { DiffEntryRow } from '../diff/DiffEntryRow';
import { useDiffReview } from '../diff/review/useDiffReview';
import { useDiffEntries } from '../diff/useDiffEntries';
import styles from './ChangedFilesSection.module.css';

const MAX_LISTED_FILES = 300;
/** Short lists read at a glance; longer ones get the path and status filter. */
const FILTER_FROM = 8;

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
  const { changesCollapsed: collapsed, set } = useDetailsLayoutStore();
  const { data: entries, error } = useDiffEntries(target, { enabled: requested, branchHead });
  const { visible, query, bar } = useChangeFilter(entries ?? [], diffEntryKey, diffEntryTones);
  const { rows, tree, toggleCollapsed } = useFileTree(visible, diffEntryKey, `details:${JSON.stringify(target)}`);
  const listed = useMemo(() => firstFilesOf(rows, MAX_LISTED_FILES), [rows]);
  const listRef = useRef<HTMLDivElement>(null);
  const workspacePath = useWorkspacePath();
  // The same menu as in the diff, review marks included, read once the files are asked for or shown from the cache.
  const review = useDiffReview(target, entries ?? NO_ENTRIES, requested || entries !== undefined);
  const shown = entries && !collapsed ? entries : undefined;
  const filterShown = shown !== undefined && shown.length > FILTER_FROM;

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
      title={entries ? `${pluralize(entries.length, 'file')} changed` : 'Changes'}
      action={shown && shown.length > 0 && !filterShown && <FileListLayoutMenu />}
      expanded={Boolean(shown?.length)}
      disclosure={entries && { open: !collapsed, toggle: () => set({ changesCollapsed: !collapsed }) }}
    >
      <div className={styles.content}>
        {!entries && !requested && (
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
        {!entries && requested && !error && <DetailsSkeleton />}
        {shown?.length === 0 && <DetailsEmpty>No file changes.</DetailsEmpty>}
        {filterShown && <div className={styles.filter}>{bar}</div>}
        {shown && shown.length > 0 && visible.length === 0 && <DetailsEmpty>No files match the filter.</DetailsEmpty>}
      </div>
      {shown && shown.length > 0 && (
        <HighlightQuery query={query}>
          <div ref={listRef} className={styles.files} onKeyDown={onListKeyDown}>
            {listed.rows.map((row) =>
              row.type === 'folder' ? (
                <ActionContextMenu key={row.key} entries={() => diffEntryMenu(workspacePath, target, row.items, review)}>
                  <button className={styles.file} onClick={() => toggleCollapsed(row.key)} aria-expanded={!row.collapsed} {...ROVING_ITEM}>
                    <DiffEntryRow row={row} tree={tree} />
                  </button>
                </ActionContextMenu>
              ) : (
                <ActionContextMenu key={row.key} entries={() => diffEntryMenu(workspacePath, target, [row.item], review)}>
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

