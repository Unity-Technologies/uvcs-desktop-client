import { ChevronRight } from 'lucide-react';
import { useRef, useState } from 'react';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { ItemPathRow } from '../../components/ItemPathRow';
import { useChangeFilter } from '../../components/useChangeFilter';
import { moveRovingFocus, ROVING_ITEM } from '../../lib/rovingFocus';
import { pluralize } from '../../lib/text';
import { DetailsChangesPane, DetailsEmpty, DetailsSkeleton } from '../../ui/DetailsPanel';
import { useDetailsLayoutStore } from '../../ui/detailsLayoutStore';
import { HighlightQuery } from '../../ui/Highlight';
import { ActionContextMenu } from '../../ui/menu/ActionContextMenu';
import { diffEntryKey } from '../diff/DiffEntryList';
import { diffEntryMenu } from '../diff/diffEntryMenu';
import { describeDiffEntry, diffEntryTone } from '../diff/diffEntrySources';
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
  const { visible, query, bar } = useChangeFilter(entries ?? [], diffEntryKey, diffEntryTone);
  const listRef = useRef<HTMLDivElement>(null);
  const workspacePath = useWorkspacePath();
  // The same menu as in the diff, review marks included.
  const review = useDiffReview(target, entries ?? NO_ENTRIES);
  const shown = entries && !collapsed ? entries : undefined;

  return (
    // No "Open diff" here: the panel's primary action at the top opens it.
    <DetailsChangesPane
      title={entries ? `${pluralize(entries.length, 'file')} changed` : 'Changes'}
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
        {shown && shown.length > FILTER_FROM && <div className={styles.filter}>{bar}</div>}
        {shown && shown.length > 0 && visible.length === 0 && <DetailsEmpty>No files match the filter.</DetailsEmpty>}
      </div>
      {shown && shown.length > 0 && (
        <HighlightQuery query={query}>
          <div ref={listRef} className={styles.files} onKeyDown={(event) => listRef.current && moveRovingFocus(listRef.current, event)}>
            {visible.slice(0, MAX_LISTED_FILES).map((entry) => (
              <ActionContextMenu key={entry.path} entries={() => diffEntryMenu(workspacePath, target, [entry], review)}>
                <button className={styles.file} onClick={() => onOpen(entry.path)} {...ROVING_ITEM}>
                  <ItemPathRow path={entry.path} itemType={entry.itemType} oldPath={entry.oldPath} status={{ tone: diffEntryTone(entry), label: describeDiffEntry(entry) }} />
                </button>
              </ActionContextMenu>
            ))}
            {visible.length > MAX_LISTED_FILES && <DetailsEmpty>And {visible.length - MAX_LISTED_FILES} more — open the diff to see them all.</DetailsEmpty>}
          </div>
        </HighlightQuery>
      )}
    </DetailsChangesPane>
  );
}
