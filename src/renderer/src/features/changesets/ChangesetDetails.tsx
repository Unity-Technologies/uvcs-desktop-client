import { FileDiff, GitCommitVertical, Tag } from 'lucide-react';
import type { Changeset } from '@shared/domain/changeset';
import { spec } from '@shared/domain/specs';
import { formatDateTime } from '../../lib/formatDate';
import { Button } from '../../ui/Button';
import { DetailsBadge, DetailsPanel, DetailsSection, DetailsText } from '../../ui/DetailsPanel';
import { PropertyList } from '../../ui/PropertyList';
import { AttributesEditor } from '../attributes/AttributesEditor';
import { useLabels } from '../labels/useLabels';
import { ChangedFilesSection } from './ChangedFilesSection';
import { openChangesetDiff } from './changesetOperations';

export function ChangesetDetails({ changeset }: { changeset: Changeset }) {
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

      <ChangedFilesSection target={{ kind: 'changeset', changesetId: changeset.id }} onOpen={(path) => openChangesetDiff(changeset, path)} />

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
