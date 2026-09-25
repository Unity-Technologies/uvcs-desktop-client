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
  /** Opens the full diff, focused on a file when given one. */
  onOpen: (focusPath?: string) => void;
}

/** The "N files changed" card of a details panel: what a changeset, branch, label, shelve or code review changed. */
export function ChangedFilesSection({ target, onOpen }: ChangedFilesSectionProps) {
  const { data: entries, error } = useDiffEntries(target);
  const { visible, query, bar } = useChangeFilter(entries ?? [], diffEntryKey, diffEntryTone);

  return (
    <DetailsSection
      title={entries ? `${pluralize(entries.length, 'file')} changed` : 'Files changed'}
      action={
        <Button variant="ghost" size="small" onClick={() => onOpen()}>
          Open diff
        </Button>
      }
    >
      {error && <DetailsEmpty>{error.message}</DetailsEmpty>}
      {!entries && !error && <DetailsSkeleton />}
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
