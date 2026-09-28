import { useQuery } from '@tanstack/react-query';
import { File, FileSymlink, Folder, History, Lock } from 'lucide-react';
import type { TreeItem } from '@shared/domain/explorer';
import { revisionRef } from '@shared/domain/revision';
import { spec } from '@shared/domain/specs';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { navigation } from '../../app/navigation/navigationStore';
import { useOtherRepository } from '../../app/workspace/useWorkspace';
import { DetailsHeading } from '../../components/DetailsHeading';
import type { MenuEntry } from '../../lib/actions';
import { formatDateTime, formatSize } from '../../lib/formatDate';
import { hotkey } from '../../lib/shortcutRegistry';
import { useSettledValue } from '../../lib/useSettled';
import { Button } from '../../ui/Button';
import { useDetailsLayoutStore } from '../../ui/detailsLayoutStore';
import { DetailsBadge, DetailsCopyable, DetailsPanel } from '../../ui/DetailsPanel';
import type { Property } from '../../ui/PropertyList';
import { BranchChip } from '../branches/BranchChip';
import { useChangeset } from '../changesets/useChangeset';
import { describeKinds, isControlled } from '../pendingChanges/changeCategories';
import type { PendingLock } from '../pendingChanges/locks/pendingLocks';
import { hasRevisionsToShow } from './fileMenuTargets';
import { FolderDetails } from './FolderDetails';
import { ItemBreadcrumb } from './ItemBreadcrumb';
import { itemComparison } from './itemComparison';
import { onDiskState, type PendingChangesIndex } from './itemStatus';
import { itemTypeLabel } from './itemType';
import { ItemViewer } from './ItemViewer';

interface ItemDetailsPaneProps {
  workspacePath: string;
  item: TreeItem;
  /** The workspace's pending changes; none in a repository tree (Browse repository), where every item is a revision. */
  pendingIndex?: PendingChangesIndex;
  lock?: PendingLock;
  /** The item's context menu, offered behind "More actions". */
  menu: MenuEntry[];
  /** Selects a folder of the item's path in the tree. */
  onSelectFolder: (path: string) => void;
  /** A folder's listing, once opened in the tree. */
  folderContents?: TreeItem[];
}

/**
 * The item selected in the tree. A file: its folders, name and status on top, and under them one diff as large as the
 * pane allows (`ItemViewer`), which says what it compares and who made the last change. A folder: its last change and
 * what it holds. The heading follows the selection at once; the viewer and what `cm` is asked once it settles, without
 * remounting, so arrowing through the tree reads and renders no file it passes.
 */
export function ItemDetailsPane({ workspacePath, item, pendingIndex, lock, menu, onSelectFolder, folderContents }: ItemDetailsPaneProps) {
  const shown = useSettledValue(item, item.path);
  const settled = shown.path === item.path;
  const inWorkspace = pendingIndex !== undefined;
  const pendingChange = pendingIndex?.changeAt(item.path);
  const isFile = item.itemType !== 'directory';
  const controlled = !item.isPrivate;
  const moreDetailsOpen = useDetailsLayoutStore((state) => state.moreDetailsOpen);
  // Under an xlink, the item's changeset and branch are the xlinked repository's.
  const otherRepository = useOtherRepository(item.repository);

  const { data: changeset } = useChangeset(!shown.isPrivate && shown.changeset !== null && shown.changeset > 0 ? shown.changeset : null, shown.repository);
  const comment = changeset?.id === shown.changeset ? changeset.comment : undefined;
  const { data: details } = useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'explorer', 'details', item.path),
    queryFn: () => api.explorer.details(workspacePath, item.path),
    enabled: inWorkspace && controlled && settled && (!isFile || moreDetailsOpen),
  });
  const shownComparison = itemComparison(shown, pendingIndex?.changeAt(shown.path), inWorkspace);

  const status = pendingChange ? describeKinds(pendingChange) : item.isPrivate ? 'Private' : item.isCheckedOut ? 'Checked out' : '';
  const onDisk = pendingChange && onDiskState(item, pendingChange);
  const size = isFile && (onDisk || item.isPrivate || item.revisionId > 0) ? formatSize(onDisk?.size ?? item.size) : '';
  const hasRevisions = pendingIndex ? hasRevisionsToShow(item, pendingIndex) : true;

  const properties: Property[] = isFile
    ? [
        { label: 'Path', value: `/${item.path}`, mono: true, copyText: `/${item.path}` },
        { label: 'Type', value: itemTypeLabel(item.itemType) },
        { label: 'Link to', value: item.symlinkTarget, mono: true },
        { label: 'Modified', value: (onDisk?.date || item.date) && formatDateTime(onDisk?.date || item.date) },
        { label: 'Revision', value: controlled && item.revisionId > 0 ? item.revisionId : '' },
        { label: 'Repository', value: details?.repository },
        { label: 'Changelist', value: details?.changelist },
        { label: 'Under xlink', value: details?.underXlinkTarget },
        { label: 'Hash', value: details?.hash, mono: true, copyText: details?.hash },
      ]
    : [];

  return (
    <DetailsPanel
      icon={item.itemType === 'directory' ? <Folder /> : item.itemType === 'symlink' ? <FileSymlink /> : <File />}
      kind={[item.itemType === 'directory' ? 'Folder' : item.itemType === 'symlink' ? 'Link' : 'File', size].filter(Boolean).join(' · ')}
      heading={
        <>
          <ItemBreadcrumb path={item.path} onSelectFolder={onSelectFolder} />
          {/* A file's last change is told by its diff's title (who, when, where); a folder's here. */}
          <DetailsHeading key={item.path} name={item.name} comment={isFile || !settled ? undefined : comment} />
        </>
      }
      author={!isFile && item.owner && controlled ? { user: item.owner, date: item.date } : undefined}
      meta={
        isFile
          ? []
          : [
              controlled && item.changeset !== null && item.changeset > 0 && <DetailsCopyable key="cs" text={spec.changeset(item.changeset, otherRepository)} what="Changeset spec" />,
              controlled && item.branch && <BranchChip key="branch" name={item.branch} otherRepository={otherRepository} />,
            ].filter(Boolean)
      }
      badges={
        <>
          {status && <DetailsBadge tone={pendingChange && isControlled(pendingChange) ? 'warning' : 'neutral'}>{status}</DetailsBadge>}
          {lock && (
            <DetailsBadge tone={lock.mine ? 'neutral' : 'warning'} tip={lock.mine ? undefined : `Workspace ${lock.workspace}`}>
              <Lock size={10} />
              {lock.mine ? 'Locked by you' : `Locked by ${lock.owner}`}
            </DetailsBadge>
          )}
        </>
      }
      primaryAction={
        hasRevisions &&
        item.path !== '' && (
          <Button
            size="small"
            variant="ghost"
            icon={<History size={13} />}
            data-tip-shortcut={inWorkspace ? hotkey('fileHistory') : undefined}
            onClick={() => navigation.openPage({ kind: 'history', path: item.path, ...(!inWorkspace && { revision: revisionRef(item) }) })}
          >
            History
          </Button>
        )
      }
      menu={menu}
      primaryActionId="history"
      properties={properties}
      changes={
        isFile &&
        shownComparison && (
          // Only the Files view switches "Diff | Annotate" with a key: Browse repository has no such command.
          <ItemViewer workspacePath={workspacePath} item={shown} comparison={shownComparison} comment={comment} viewShortcut={inWorkspace ? hotkey('annotate') : undefined} />
        )
      }
    >
      {!isFile && <FolderDetails item={item} contents={folderContents} changesInside={pendingIndex?.countInside(item.path)} details={details} />}
    </DetailsPanel>
  );
}
