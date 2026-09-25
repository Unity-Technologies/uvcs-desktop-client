import type { DiffTarget } from '@shared/domain/diff';
import { PathLabel } from '../../components/PathLabel';
import { StatusBadge } from '../../components/StatusBadge';
import { pluralize } from '../../lib/text';
import { DetailsEmpty, DetailsSection } from '../../ui/DetailsPanel';
import { Spinner } from '../../ui/Spinner';
import { describeDiffEntry, diffEntryTone } from '../diff/diffEntrySources';
import { useDiffEntries } from '../diff/useDiffEntries';
import styles from './ChangedFilesSection.module.css';

const MAX_LISTED_FILES = 300;

interface ChangedFilesSectionProps {
  target: DiffTarget;
  /** Opens the diff focused on a file. */
  onOpen: (path: string) => void;
}

/** The "N files changed" card of a details panel: what a changeset, branch, label or shelve changed. */
export function ChangedFilesSection({ target, onOpen }: ChangedFilesSectionProps) {
  const { data: entries, error } = useDiffEntries(target);

  return (
    <DetailsSection title={entries ? `${pluralize(entries.length, 'file')} changed` : 'Files changed'}>
      {error && <DetailsEmpty>{error.message}</DetailsEmpty>}
      {!entries && !error && <Spinner />}
      {entries?.length === 0 && <DetailsEmpty>No file changes.</DetailsEmpty>}
      <div className={styles.files}>
        {entries?.slice(0, MAX_LISTED_FILES).map((entry) => (
          <button key={entry.path} className={styles.file} onClick={() => onOpen(entry.path)}>
            <StatusBadge tone={diffEntryTone(entry)} title={describeDiffEntry(entry)} />
            <PathLabel path={entry.path} oldPath={entry.oldPath} strikethrough={entry.status === 'deleted'} />
          </button>
        ))}
      </div>
      {entries && entries.length > MAX_LISTED_FILES && (
        <DetailsEmpty>And {entries.length - MAX_LISTED_FILES} more — open the diff to see them all.</DetailsEmpty>
      )}
    </DetailsSection>
  );
}
