import { FileDiff, Tag } from 'lucide-react';
import { useMemo } from 'react';
import type { Changeset } from '@shared/domain/changeset';
import { PathLabel } from '../../components/PathLabel';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDateTime } from '../../lib/formatDate';
import { pluralize } from '../../lib/text';
import { Button } from '../../ui/Button';
import { Spinner } from '../../ui/Spinner';
import { describeDiffEntry, diffEntryTone } from '../diff/diffEntrySources';
import { useDiffEntries } from '../diff/useDiffEntries';
import { useLabels } from '../labels/useLabels';
import { openChangesetDiff } from './changesetOperations';
import { ChangesetSummary } from './ChangesetSummary';
import styles from './ChangesetDetails.module.css';

const MAX_LISTED_FILES = 300;

export function ChangesetDetails({ changeset }: { changeset: Changeset }) {
  const target = useMemo(() => ({ kind: 'changeset' as const, changesetId: changeset.id }), [changeset.id]);
  const { data: entries, error } = useDiffEntries(target);
  const { data: labels } = useLabels();
  const changesetLabels = labels?.filter((label) => label.changeset === changeset.id) ?? [];

  return (
    <div className={styles.details}>
      <section className={styles.section}>
        <ChangesetSummary changeset={changeset} />
        {changesetLabels.length > 0 && (
          <div className={styles.labels}>
            {changesetLabels.map((label) => (
              <span key={label.id} className={styles.label} title={label.comment}>
                <Tag size={11} />
                {label.name}
              </span>
            ))}
          </div>
        )}
        <dl className={styles.properties}>
          <dt>Created</dt>
          <dd>{formatDateTime(changeset.date)}</dd>
          <dt>Parent</dt>
          <dd>{changeset.parent >= 0 ? `cs:${changeset.parent}` : '—'}</dd>
          <dt>Repository</dt>
          <dd>{changeset.repository}</dd>
          <dt>GUID</dt>
          <dd className="selectable">{changeset.guid}</dd>
        </dl>
        <Button icon={<FileDiff size={14} />} onClick={() => openChangesetDiff(changeset)}>
          Open diff
        </Button>
      </section>

      <section className={styles.files}>
        <div className={styles.filesHeader}>{entries ? pluralize(entries.length, 'file') + ' changed' : 'Files changed'}</div>
        {error && <div className={styles.error}>{error.message}</div>}
        {!entries && !error && <Spinner />}
        {entries?.slice(0, MAX_LISTED_FILES).map((entry) => (
          <button key={entry.path} className={styles.file} onClick={() => openChangesetDiff(changeset, entry.path)}>
            <StatusBadge tone={diffEntryTone(entry)} title={describeDiffEntry(entry)} />
            <PathLabel path={entry.path} oldPath={entry.oldPath} strikethrough={entry.status === 'deleted'} />
          </button>
        ))}
        {entries && entries.length > MAX_LISTED_FILES && (
          <div className={styles.more}>and {entries.length - MAX_LISTED_FILES} more — open the diff to see them all</div>
        )}
      </section>
    </div>
  );
}
