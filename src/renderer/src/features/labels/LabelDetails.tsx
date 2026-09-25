import { ArrowRightLeft, FileDiff, GitMerge, Tag } from 'lucide-react';
import type { Label } from '@shared/domain/label';
import { spec } from '@shared/domain/specs';
import { formatDateTime } from '../../lib/formatDate';
import { Button } from '../../ui/Button';
import { DetailsPanel, DetailsSection, DetailsText } from '../../ui/DetailsPanel';
import { PropertyList } from '../../ui/PropertyList';
import { AttributesEditor } from '../attributes/AttributesEditor';
import { mergeFromLabel, showLabelChanges, switchToLabel } from './labelOperations';

export function LabelDetails({ workspacePath, label }: { workspacePath: string; label: Label }) {
  return (
    <DetailsPanel
      icon={<Tag />}
      kind="Label"
      context={`Changeset ${label.changeset} · ${label.branch}`}
      title={label.name}
      author={{ user: label.owner, date: label.date }}
      actions={
        <>
          <Button variant="primary" icon={<ArrowRightLeft size={14} />} onClick={() => void switchToLabel(workspacePath, label)}>
            Switch
          </Button>
          <Button icon={<GitMerge size={14} />} onClick={() => mergeFromLabel(label)}>
            Merge
          </Button>
          <Button icon={<FileDiff size={14} />} onClick={() => showLabelChanges(label)}>
            Changes
          </Button>
        </>
      }
    >
      <DetailsSection title="Comment">
        <DetailsText text={label.comment} placeholder="No comment" />
      </DetailsSection>
      <DetailsSection title="Properties">
        <PropertyList
          properties={[
            { label: 'Created', value: formatDateTime(label.date) },
            { label: 'Changeset', value: label.changeset, copyText: `cs:${label.changeset}` },
            { label: 'Branch', value: label.branch },
          ]}
        />
      </DetailsSection>
      <AttributesEditor key={label.name} objectSpec={spec.label(label.name)} />
    </DetailsPanel>
  );
}
