import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { DiffTarget } from '@shared/domain/diff';
import { PathLabel } from '../../components/PathLabel';
import { StatusBadge } from '../../components/StatusBadge';
import { useChangeFilter } from '../../components/useChangeFilter';
import { pluralize } from '../../lib/text';
import { Button } from '../../ui/Button';
import { DetailsEmpty, DetailsSection, DetailsSkeleton } from '../../ui/DetailsPanel';
import { HighlightQuery } from '../../ui/Highlight';
import { diffEntryKey } from '../diff/DiffEntryList';
import { describeDiffEntry, diffEntryTone } from '../diff/diffEntrySources';
import { useDiffEntries } from '../diff/useDiffEntries';
import styles from './ChangedFilesSection.module.css';

const MAX_LISTED_FILES = 300;
/** Short lists read at a glance; longer ones get the path and status filter. */
const FILTER_FROM = 8;

interface ChangedFilesSectionProps {
  target: DiffTarget;
  /** For a branch, its head: the list is reused until the branch moves. */
  branchHead?: number;
  /** Opens the full diff, focused on a file when given one. */
  onOpen: (focusPath?: string) => void;
}

/**
 * The changed files card of a details panel: what a changeset, branch, label, shelve or code review changed.
 * Selecting an object never runs `cm diff` (it is heavy on big changes and servers): the list loads when asked
 * for, and stays cached, so it shows right away when that object is selected again.
 */
export function ChangedFilesSection({ target, branchHead, onOpen }: ChangedFilesSectionProps) {
  const [requested, setRequested] = useState(false);
  const { data: entries, error } = useDiffEntries(target, { enabled: requested, branchHead });
  const { visible, query, bar } = useChangeFilter(entries ?? [], diffEntryKey, diffEntryTone);

  return (
    <DetailsSection
      title={entries ? `${pluralize(entries.length, 'file')} changed` : 'Changed files'}
      action={
        <Button variant="ghost" size="small" onClick={() => onOpen()}>
          Open diff
        </Button>
      }
    >
      {!entries && !requested && (
        <button className={styles.show} onClick={() => setRequested(true)}>
          <ChevronRight size={14} />
          Show changed files
        </button>
      )}
      {error && <DetailsEmpty>{error.message}</DetailsEmpty>}
      {!entries && requested && !error && <DetailsSkeleton />}
      {entries?.length === 0 && <DetailsEmpty>No file changes.</DetailsEmpty>}
      {entries && entries.length > FILTER_FROM && <div className={styles.filter}>{bar}</div>}
      {entries && entries.length > 0 && visible.length === 0 && <DetailsEmpty>No files match the filter.</DetailsEmpty>}
      <HighlightQuery query={query}>
        <div className={styles.files}>
          {visible.slice(0, MAX_LISTED_FILES).map((entry) => (
            <button key={entry.path} className={styles.file} onClick={() => onOpen(entry.path)}>
              <StatusBadge tone={diffEntryTone(entry)} title={describeDiffEntry(entry)} />
              <PathLabel path={entry.path} oldPath={entry.oldPath} strikethrough={entry.status === 'deleted'} />
            </button>
          ))}
        </div>
      </HighlightQuery>
      {visible.length > MAX_LISTED_FILES && <DetailsEmpty>And {visible.length - MAX_LISTED_FILES} more — open the diff to see them all.</DetailsEmpty>}
    </DetailsSection>
  );
}
