import { useQuery } from '@tanstack/react-query';
import { File, Folder } from 'lucide-react';
import type { TreeItem } from '@shared/domain/explorer';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import type { MenuEntry } from '../../lib/actions';
import { formatDateTime, formatSize } from '../../lib/formatDate';
import { DetailsBadge, DetailsPanel, DetailsSection } from '../../ui/DetailsPanel';
import { PropertyList, type Property } from '../../ui/PropertyList';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { ChangeDiffPanel } from '../pendingChanges/ChangeDiffPanel';
import { describeKinds } from '../pendingChanges/changeCategories';
import { useFilesViewStore, type DetailsTab } from './filesViewStore';
import { RevisionChanges } from './RevisionChanges';

interface ItemDetailsPaneProps {
  workspacePath: string;
  item: TreeItem;
  pendingChange?: PendingChange;
  /** The item's context menu, offered behind "More actions". */
  menu: MenuEntry[];
}

/** A file's changes are one diff rather than a list of files, so the panel switches between its details and that diff. */
export function ItemDetailsPane({ workspacePath, item, pendingChange, menu }: ItemDetailsPaneProps) {
  const { detailsTab, setDetailsTab } = useFilesViewStore();
  const hasChanges = !item.isPrivate && item.itemType !== 'directory';
  const showChanges = hasChanges && detailsTab === 'changes';
  const nameStart = item.path.lastIndexOf('/') + 1;

  return (
    <DetailsPanel
      icon={item.itemType === 'directory' ? <Folder /> : <File />}
      kind={item.itemType === 'directory' ? 'Folder' : 'File'}
      context={`/${item.path.slice(0, nameStart)}`}
      title={item.name}
      author={item.owner && !item.isPrivate ? { user: item.owner, date: item.date } : undefined}
      badges={
        pendingChange ? (
          <DetailsBadge tone="warning">{describeKinds(pendingChange)}</DetailsBadge>
        ) : item.isPrivate ? (
          <DetailsBadge>Private</DetailsBadge>
        ) : undefined
      }
      primaryAction={
        hasChanges && (
          <SegmentedControl<DetailsTab>
            value={detailsTab}
            onChange={setDetailsTab}
            segments={[
              { value: 'details', label: 'Details' },
              { value: 'changes', label: pendingChange ? 'Pending changes' : 'Last change' },
            ]}
          />
        )
      }
      menu={menu}
      primaryActionId={hasChanges ? 'changes' : undefined}
      fill={showChanges}
    >
      {showChanges ? (
        pendingChange ? (
          <ChangeDiffPanel workspacePath={workspacePath} change={pendingChange} />
        ) : (
          <RevisionChanges workspacePath={workspacePath} item={item} />
        )
      ) : (
        <DetailsSection title="Details">
          <ItemProperties workspacePath={workspacePath} item={item} pendingChange={pendingChange} />
        </DetailsSection>
      )}
    </DetailsPanel>
  );
}

function ItemProperties({ workspacePath, item, pendingChange }: Omit<ItemDetailsPaneProps, 'menu'>) {
  const { data: details } = useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'explorer', 'details', item.path),
    queryFn: () => api.explorer.details(workspacePath, item.path),
    enabled: !item.isPrivate,
  });

  const properties: Property[] = [
    { label: 'Path', value: `/${item.path}`, mono: true, copyText: `/${item.path}` },
    { label: 'Status', value: pendingChange ? describeKinds(pendingChange) : item.isPrivate ? 'Private' : 'Up to date' },
    { label: 'Type', value: item.itemType === 'directory' ? 'Folder' : item.itemType === 'binaryFile' ? 'Binary file' : 'Text file' },
    { label: 'Size', value: item.itemType === 'directory' ? '' : formatSize(item.size) },
    { label: 'Modified', value: item.date && formatDateTime(item.date) },
  ];
  if (!item.isPrivate) {
    properties.push(
      { label: 'Changeset', value: item.changeset > 0 ? item.changeset : '' },
      { label: 'Branch', value: item.branch },
      { label: 'Revision', value: item.revisionId > 0 ? item.revisionId : '' },
      { label: 'Repository', value: details?.repository },
      { label: 'Changelist', value: details?.changelist },
      { label: 'Xlink to', value: details?.xlinkTarget },
      { label: 'Under xlink', value: details?.underXlinkTarget },
      { label: 'Hash', value: details?.hash, mono: true, copyText: details?.hash },
    );
  }

  return <PropertyList properties={properties} />;
}
