import { Archive, FileDiff } from 'lucide-react';
import type { Shelve } from '@shared/domain/shelve';
import { spec } from '@shared/domain/specs';
import type { MenuEntry } from '../../lib/actions';
import { formatDateTime } from '../../lib/formatDate';
import { firstLine } from '../../lib/text';
import { Button } from '../../ui/Button';
import { DetailsComment } from '../../ui/DetailsComment';
import { DetailsPanel, DetailsSection } from '../../ui/DetailsPanel';
import { PropertyList } from '../../ui/PropertyList';
import { ChangedFilesSection } from '../changesets/ChangedFilesSection';
import { showShelveChanges } from './shelveOperations';

export function ShelveDetails({ shelve, menu }: { shelve: Shelve; menu: MenuEntry[] }) {
  return (
    <DetailsPanel
      icon={<Archive />}
      kind={`Shelve ${shelve.id}`}
      context={`On changeset ${shelve.parentChangeset}`}
      title={firstLine(shelve.comment) || 'No comment'}
      author={{ user: shelve.owner, date: shelve.date }}
      primaryAction={
        <Button variant="primary" icon={<FileDiff size={14} />} onClick={() => showShelveChanges(shelve)}>
          Open diff
        </Button>
      }
      menu={menu}
      primaryActionId="diff"
    >
      <DetailsComment text={shelve.comment} />
      <ChangedFilesSection target={{ kind: 'shelve', shelveId: shelve.id }} onOpen={(path) => showShelveChanges(shelve, path)} />
      <DetailsSection title="Details">
        <PropertyList
          properties={[
            { label: 'Created', value: formatDateTime(shelve.date) },
            { label: 'Based on', value: `Changeset ${shelve.parentChangeset}`, copyText: spec.changeset(shelve.parentChangeset) },
            { label: 'Repository', value: shelve.repository },
            { label: 'GUID', value: shelve.guid, mono: true, copyText: shelve.guid },
          ]}
        />
      </DetailsSection>
    </DetailsPanel>
  );
}
