import { FileDiff, Tag } from 'lucide-react';
import type { Label } from '@shared/domain/label';
import { spec } from '@shared/domain/specs';
import { PathLabel } from '../../components/PathLabel';
import type { MenuEntry } from '../../lib/actions';
import { formatDateTime } from '../../lib/formatDate';
import { Button } from '../../ui/Button';
import { DetailsComment } from '../../ui/DetailsComment';
import { DetailsPanel, DetailsSection } from '../../ui/DetailsPanel';
import { PropertyList } from '../../ui/PropertyList';
import { AttributesEditor } from '../attributes/AttributesEditor';
import { ChangedFilesSection } from '../changesets/ChangedFilesSection';
import { showLabelChanges } from './labelOperations';

export function LabelDetails({ label, menu }: { label: Label; menu: MenuEntry[] }) {
  return (
    <DetailsPanel
      icon={<Tag />}
      kind="Label"
      context={<PathLabel path={label.branch} />}
      title={label.name}
      author={{ user: label.owner, date: label.date }}
      primaryAction={
        <Button variant="primary" icon={<FileDiff size={14} />} onClick={() => showLabelChanges(label)}>
          Open diff
        </Button>
      }
      menu={menu}
      primaryActionId="diff"
    >
      <DetailsComment text={label.comment} />
      <ChangedFilesSection target={{ kind: 'changeset', changesetId: label.changeset }} onOpen={(path) => showLabelChanges(label, path)} />
      <DetailsSection title="Details">
        <PropertyList
          properties={[
            { label: 'Created', value: formatDateTime(label.date) },
            { label: 'Changeset', value: `Changeset ${label.changeset}`, copyText: spec.changeset(label.changeset) },
            { label: 'Branch', value: label.branch },
            { label: 'Repository', value: label.repository },
          ]}
        />
      </DetailsSection>
      <AttributesEditor key={label.name} objectSpec={spec.label(label.name)} />
    </DetailsPanel>
  );
}
