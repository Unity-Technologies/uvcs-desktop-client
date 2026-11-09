import { SlidersHorizontal } from 'lucide-react';
import { openSettingsDialogAt } from '../../app/settings/SettingsDialog';
import { formatCount } from '../../lib/text';
import { IconButton } from '../../ui/IconButton';
import { ViewHeader } from '../../ui/ViewHeader';
import { MyShelvesButton } from '../shelves/MyShelvesButton';
import { RefreshButton } from './RefreshButton';

interface PendingChangesHeaderProps {
  workspacePath: string;
  /** How many changes are pending; undefined until read, and while nothing is pending: the list says "0 files". */
  pendingCount: number | undefined;
  fetching: boolean;
}

/**
 * The Changes view's header: the count and the view's buttons. It keeps its shape while the changes load and when
 * nothing is pending, as the list beneath it does. How the list shows its files, grouped by changelist too, is the
 * filter bar's view menu, as in every list of files (`FileListViewMenu`).
 */
export function PendingChangesHeader({ workspacePath, pendingCount, fetching }: PendingChangesHeaderProps) {
  return (
    <ViewHeader
      title="Changes"
      subtitle={pendingCount !== undefined && `${formatCount(pendingCount)} pending`}
      actions={
        <>
          <MyShelvesButton />
          <RefreshButton workspacePath={workspacePath} fetching={fetching} />
          <IconButton icon={<SlidersHorizontal size={14} />} label="What to show" onClick={() => openSettingsDialogAt('pendingChanges')} />
        </>
      }
    />
  );
}
