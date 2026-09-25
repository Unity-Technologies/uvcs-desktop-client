import { FileDiff, Tag } from 'lucide-react';
import type { Label } from '@shared/domain/label';
import { spec } from '@shared/domain/specs';
import { DetailsHeading } from '../../components/DetailsHeading';
import type { MenuEntry } from '../../lib/actions';
import { formatDateTime } from '../../lib/formatDate';
import { Button } from '../../ui/Button';
import { DetailsCopyable, DetailsPanel } from '../../ui/DetailsPanel';
import { AttributeChips } from '../attributes/AttributeChips';
import { BranchChip } from '../branches/BranchChip';
import { ChangedFilesSection } from '../changesets/ChangedFilesSection';
import { showLabelChanges } from './labelOperations';

export function LabelDetails({ label, menu }: { label: Label; menu: MenuEntry[] }) {
  return (
    <DetailsPanel
      icon={<Tag />}
      kind="Label"
      heading={<DetailsHeading name={label.name} comment={label.comment} />}
      author={{ user: label.owner, date: label.date }}
      meta={[
        <DetailsCopyable key="changeset" text={spec.changeset(label.changeset)} what="Changeset spec" />,
        <BranchChip key="branch" name={label.branch} />,
      ]}
      attributes={<AttributeChips key={label.name} objectSpec={spec.label(label.name)} />}
      primaryAction={
        <Button variant="primary" size="small" icon={<FileDiff size={13} />} onClick={() => showLabelChanges(label)}>
          Open diff
        </Button>
      }
      menu={menu}
      primaryActionId="diff"
      properties={[
        { label: 'Created', value: formatDateTime(label.date) },
        { label: 'Changeset', value: `Changeset ${label.changeset}`, copyText: spec.changeset(label.changeset) },
        { label: 'Branch', value: label.branch },
        { label: 'Repository', value: label.repository },
      ]}
      changes={<ChangedFilesSection target={{ kind: 'changeset', changesetId: label.changeset }} onOpen={(path) => showLabelChanges(label, path)} />}
    />
  );
}
