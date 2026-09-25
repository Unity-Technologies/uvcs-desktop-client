import { ArrowRightLeft, FileDiff, GitMerge, Tag } from 'lucide-react';
import type { Label } from '@shared/domain/label';
import { spec } from '@shared/domain/specs';
import { formatDateTime } from '../../lib/formatDate';
import { UserLabel } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { DetailsPanel, DetailsSection, DetailsText, PropertyList } from '../../ui/DetailsPanel';
import { AttributesEditor } from '../attributes/AttributesEditor';
import { mergeFromLabel, showLabelChanges, switchToLabel } from './labelOperations';

export function LabelDetails({ workspacePath, label }: { workspacePath: string; label: Label }) {
  return (
    <DetailsPanel
      icon={<Tag size={18} />}
      title={label.name}
      subtitle={`Changeset ${label.changeset} on ${label.branch}`}
      actions={
        <>
          <Button size="small" variant="primary" icon={<ArrowRightLeft size={13} />} onClick={() => void switchToLabel(workspacePath, label)}>
            Switch
          </Button>
          <Button size="small" icon={<GitMerge size={13} />} onClick={() => mergeFromLabel(label)}>
            Merge
          </Button>
          <Button size="small" icon={<FileDiff size={13} />} onClick={() => showLabelChanges(label)}>
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
            ['Created by', <UserLabel user={label.owner} />],
            ['Created', formatDateTime(label.date)],
            ['Changeset', label.changeset],
            ['Branch', label.branch],
            ['Repository', label.repository],
          ]}
        />
      </DetailsSection>
      <AttributesEditor key={label.name} objectSpec={spec.label(label.name)} />
    </DetailsPanel>
  );
}
