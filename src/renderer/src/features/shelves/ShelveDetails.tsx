import { Archive, ArchiveRestore, FileDiff, Trash2 } from 'lucide-react';
import type { Shelve } from '@shared/domain/shelve';
import { formatDateTime } from '../../lib/formatDate';
import { UserLabel } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { DetailsPanel, DetailsSection, DetailsText, PropertyList } from '../../ui/DetailsPanel';
import { applyShelve, deleteShelve, showShelveChanges } from './shelveOperations';

export function ShelveDetails({ workspacePath, shelve }: { workspacePath: string; shelve: Shelve }) {
  return (
    <DetailsPanel
      icon={<Archive size={18} />}
      title={`Shelve ${shelve.id}`}
      subtitle={`Made on top of changeset ${shelve.parentChangeset}`}
      actions={
        <>
          <Button size="small" variant="primary" icon={<ArchiveRestore size={13} />} onClick={() => void applyShelve(workspacePath, shelve)}>
            Apply
          </Button>
          <Button size="small" icon={<FileDiff size={13} />} onClick={() => showShelveChanges(shelve)}>
            Changes
          </Button>
          <Button size="small" variant="ghost" icon={<Trash2 size={13} />} onClick={() => void deleteShelve(workspacePath, shelve)}>
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
            ['Created by', <UserLabel user={shelve.owner} />],
            ['Created', formatDateTime(shelve.date)],
            ['Based on', `Changeset ${shelve.parentChangeset}`],
            ['Repository', shelve.repository],
          ]}
        />
      </DetailsSection>
    </DetailsPanel>
  );
}
