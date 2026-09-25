import { Archive, ArchiveRestore, FileDiff, Trash2 } from 'lucide-react';
import type { Shelve } from '@shared/domain/shelve';
import { formatDateTime } from '../../lib/formatDate';
import { Button } from '../../ui/Button';
import { DetailsPanel, DetailsSection, DetailsText } from '../../ui/DetailsPanel';
import { PropertyList } from '../../ui/PropertyList';
import { applyShelve, deleteShelve, showShelveChanges } from './shelveOperations';

export function ShelveDetails({ workspacePath, shelve }: { workspacePath: string; shelve: Shelve }) {
  return (
    <DetailsPanel
      icon={<Archive />}
      kind="Shelve"
      context={`On top of changeset ${shelve.parentChangeset}`}
      title={`Shelve ${shelve.id}`}
      author={{ user: shelve.owner, date: shelve.date }}
      actions={
        <>
          <Button variant="primary" icon={<ArchiveRestore size={14} />} onClick={() => void applyShelve(workspacePath, shelve)}>
            Apply
          </Button>
          <Button icon={<FileDiff size={14} />} onClick={() => showShelveChanges(shelve)}>
            Changes
          </Button>
          <Button variant="ghost" icon={<Trash2 size={14} />} onClick={() => void deleteShelve(workspacePath, shelve)}>
            Delete
          </Button>
        </>
      }
    >
      <DetailsSection title="Comment">
        <DetailsText text={shelve.comment} placeholder="No comment" />
      </DetailsSection>
      <DetailsSection title="Properties">
        <PropertyList
          properties={[
            { label: 'Created', value: formatDateTime(shelve.date) },
            { label: 'Based on', value: `Changeset ${shelve.parentChangeset}` },
          ]}
        />
      </DetailsSection>
    </DetailsPanel>
  );
}
