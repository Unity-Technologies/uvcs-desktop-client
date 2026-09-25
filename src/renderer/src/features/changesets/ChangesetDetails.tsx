import { FileDiff, GitCommitVertical, Tag } from 'lucide-react';
import { useMemo } from 'react';
import type { Changeset } from '@shared/domain/changeset';
import { spec } from '@shared/domain/specs';
import { PathLabel } from '../../components/PathLabel';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDateTime } from '../../lib/formatDate';
import { pluralize } from '../../lib/text';
import { Button } from '../../ui/Button';
import { DetailsBadge, DetailsEmpty, DetailsPanel, DetailsSection, DetailsText } from '../../ui/DetailsPanel';
import { PropertyList } from '../../ui/PropertyList';
import { Spinner } from '../../ui/Spinner';
import { AttributesEditor } from '../attributes/AttributesEditor';
import { describeDiffEntry, diffEntryTone } from '../diff/diffEntrySources';
import { useDiffEntries } from '../diff/useDiffEntries';
import { useLabels } from '../labels/useLabels';
import { openChangesetDiff } from './changesetOperations';
import styles from './ChangesetDetails.module.css';

const MAX_LISTED_FILES = 300;

export function ChangesetDetails({ changeset }: { changeset: Changeset }) {
  const target = useMemo(() => ({ kind: 'changeset' as const, changesetId: changeset.id }), [changeset.id]);
  const { data: entries, error } = useDiffEntries(target);
  const { data: labels } = useLabels();
  const changesetLabels = labels?.filter((label) => label.changeset === changeset.id) ?? [];
  const [summary, ...rest] = changeset.comment.split('\n');
  const description = rest.join('\n').trim();

  return (
    <DetailsPanel
      icon={<GitCommitVertical />}
      kind={`Changeset ${changeset.id}`}
      context={changeset.branch}
      title={summary || 'No comment'}
      author={{ user: changeset.owner, date: changeset.date }}
      badges={changesetLabels.map((label) => (
        <DetailsBadge key={label.id} tone="warning">
          <Tag size={10} />
          {label.name}
        </DetailsBadge>
      ))}
      actions={
        <Button variant="primary" icon={<FileDiff size={14} />} onClick={() => openChangesetDiff(changeset)}>
          Open diff
        </Button>
      }
    >
      {description && (
        <DetailsSection title="Description">
          <DetailsText text={description} placeholder="" />
        </DetailsSection>
      )}

      <DetailsSection title={entries ? `${pluralize(entries.length, 'file')} changed` : 'Files changed'}>
        {error && <DetailsEmpty>{error.message}</DetailsEmpty>}
        {!entries && !error && <Spinner />}
        {entries?.length === 0 && <DetailsEmpty>No file changes.</DetailsEmpty>}
        <div className={styles.files}>
          {entries?.slice(0, MAX_LISTED_FILES).map((entry) => (
            <button key={entry.path} className={styles.file} onClick={() => openChangesetDiff(changeset, entry.path)}>
              <StatusBadge tone={diffEntryTone(entry)} title={describeDiffEntry(entry)} />
              <PathLabel path={entry.path} oldPath={entry.oldPath} strikethrough={entry.status === 'deleted'} />
            </button>
          ))}
        </div>
        {entries && entries.length > MAX_LISTED_FILES && (
          <DetailsEmpty>And {entries.length - MAX_LISTED_FILES} more — open the diff to see them all.</DetailsEmpty>
        )}
      </DetailsSection>

      <DetailsSection title="Details">
        <PropertyList
          properties={[
            { label: 'Created', value: formatDateTime(changeset.date) },
            { label: 'Parent', value: changeset.parent >= 0 ? `Changeset ${changeset.parent}` : '', copyText: spec.changeset(changeset.parent) },
            { label: 'Repository', value: changeset.repository },
            { label: 'GUID', value: changeset.guid, mono: true, copyText: changeset.guid },
          ]}
        />
      </DetailsSection>
      <AttributesEditor key={changeset.id} objectSpec={spec.changeset(changeset.id)} />
    </DetailsPanel>
  );
}
