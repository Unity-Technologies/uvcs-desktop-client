import { useQuery } from '@tanstack/react-query';
import type { TreeItem } from '@shared/domain/explorer';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { formatDateTime, formatSize } from '../../lib/formatDate';
import { UserLabel } from '../../ui/Avatar';
import { PropertyList, type Property } from '../../ui/PropertyList';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { ChangeDiffPanel } from '../pendingChanges/ChangeDiffPanel';
import { describeKinds } from '../pendingChanges/changeCategories';
import { useFilesViewStore, type DetailsTab } from './filesViewStore';
import { RevisionChanges } from './RevisionChanges';
import styles from './ItemDetailsPane.module.css';

interface ItemDetailsPaneProps {
  workspacePath: string;
  item: TreeItem;
  pendingChange?: PendingChange;
}

export function ItemDetailsPane({ workspacePath, item, pendingChange }: ItemDetailsPaneProps) {
  const { detailsTab, setDetailsTab } = useFilesViewStore();

  return (
    <div className={styles.pane}>
      <div className={styles.header}>
        <span className={styles.name} title={item.path}>
          {item.name}
        </span>
        {!item.isPrivate && (
          <SegmentedControl<DetailsTab>
            value={detailsTab}
            onChange={setDetailsTab}
            segments={[
              { value: 'details', label: 'Details' },
              { value: 'changes', label: pendingChange ? 'Pending changes' : 'Last change' },
            ]}
          />
        )}
      </div>
      {detailsTab === 'changes' && !item.isPrivate ? (
        pendingChange ? (
          <ChangeDiffPanel workspacePath={workspacePath} change={pendingChange} />
        ) : (
          <RevisionChanges workspacePath={workspacePath} item={item} />
        )
      ) : (
        <div className={styles.details}>
          <ItemProperties workspacePath={workspacePath} item={item} pendingChange={pendingChange} />
        </div>
      )}
    </div>
  );
}

function ItemProperties({ workspacePath, item, pendingChange }: ItemDetailsPaneProps) {
  const { data: details } = useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'explorer', 'details', item.path),
    queryFn: () => api.explorer.details(workspacePath, item.path),
    enabled: !item.isPrivate,
  });

  const properties: Property[] = [
    { label: 'Path', value: `/${item.path}`, mono: true },
    { label: 'Status', value: pendingChange ? describeKinds(pendingChange) : item.isPrivate ? 'Private' : 'Up to date' },
    { label: 'Type', value: item.itemType === 'directory' ? 'Folder' : item.itemType === 'binaryFile' ? 'Binary file' : 'Text file' },
    { label: 'Size', value: item.itemType === 'directory' ? '' : formatSize(item.size) },
    { label: 'Modified', value: item.date && formatDateTime(item.date) },
  ];
  if (!item.isPrivate) {
    properties.push(
      { label: 'Changeset', value: item.changeset > 0 ? item.changeset : '' },
      { label: 'Branch', value: item.branch },
      { label: 'Owner', value: item.owner && <UserLabel user={item.owner} /> },
      { label: 'Revision', value: item.revisionId > 0 ? item.revisionId : '' },
      { label: 'Repository', value: details?.repository },
      { label: 'Changelist', value: details?.changelist },
      { label: 'Xlink to', value: details?.xlinkTarget },
      { label: 'Under xlink', value: details?.underXlinkTarget },
      { label: 'Hash', value: details?.hash, mono: true },
    );
  }

  return <PropertyList properties={properties} />;
}
