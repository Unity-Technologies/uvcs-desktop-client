import { Archive, FileDiff } from 'lucide-react';
import { Fragment } from 'react';
import type { Shelve } from '@shared/domain/shelve';
import { spec } from '@shared/domain/specs';
import { DetailsHeading } from '../../components/DetailsHeading';
import type { MenuEntry } from '../../lib/actions';
import { formatDateTime } from '../../lib/formatDate';
import { Button } from '../../ui/Button';
import { DetailsCopyable } from '../../ui/DetailsCopyable';
import { DetailsPanel } from '../../ui/DetailsPanel';
import { ChangedFilesSection } from '../changesets/ChangedFilesSection';
import { showShelveChanges } from './shelveOperations';
import { copiedWhat } from '../../components/copyMenu';

export function ShelveDetails({ shelve, menu }: { shelve: Shelve; menu: MenuEntry[] }) {
  return (
    <DetailsPanel
      icon={<Archive />}
      kind="Shelve"
      heading={<DetailsHeading comment={shelve.comment} />}
      author={{ user: shelve.owner, date: shelve.date }}
      meta={[
        <DetailsCopyable key="id" text={spec.shelve(shelve.id)} what={copiedWhat('Shelve', 'spec')} />,
        <Fragment key="base">
          on <DetailsCopyable text={spec.changeset(shelve.parentChangeset)} what={copiedWhat('Changeset', 'spec')} />
        </Fragment>,
      ]}
      primaryAction={
        <Button variant="primary" size="small" icon={<FileDiff size={13} />} onClick={() => showShelveChanges(shelve)}>
          Open diff
        </Button>
      }
      menu={menu}
      primaryActionId="diff"
      properties={[
        { label: 'Created', value: formatDateTime(shelve.date) },
        { label: 'Based on', value: `Changeset ${shelve.parentChangeset}`, copyText: spec.changeset(shelve.parentChangeset) },
        { label: 'Repository', value: shelve.repository },
        { label: 'GUID', value: shelve.guid, mono: true, copyText: shelve.guid },
      ]}
      changes={<ChangedFilesSection target={{ kind: 'shelve', shelveId: shelve.id }} onOpen={(path) => showShelveChanges(shelve, path)} />}
    />
  );
}
