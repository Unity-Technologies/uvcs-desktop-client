import { SlidersHorizontal } from 'lucide-react';
import { openSettingsDialogAt } from '../../app/settings/SettingsDialog';
import { formatCount } from '../../lib/text';
import { IconButton } from '../../ui/IconButton';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { ViewHeader } from '../../ui/ViewHeader';
import { MyShelvesButton } from '../shelves/MyShelvesButton';
import type { ChangesGrouping } from './changeRows';
import { usePendingChangesViewStore } from './pendingChangesViewStore';
import { RefreshButton } from './RefreshButton';

interface PendingChangesHeaderProps {
  workspacePath: string;
  /** How many changes are pending; undefined until read, and while nothing is pending: the list says "0 files". */
  pendingCount: number | undefined;
  fetching: boolean;
}

/**
 * The Changes view's header: the count, how the list is grouped, and the view's buttons. It keeps its shape while the
 * changes load and when nothing is pending, as the list beneath it does. The List/Tree switch is the filter bar's, as
 * in every list of files.
 */
export function PendingChangesHeader({ workspacePath, pendingCount, fetching }: PendingChangesHeaderProps) {
  const grouping = usePendingChangesViewStore((state) => state.grouping);
  const setGrouping = usePendingChangesViewStore((state) => state.setGrouping);
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
    >
      <SegmentedControl<ChangesGrouping>
        value={grouping}
        onChange={setGrouping}
        segments={[
          { value: 'none', label: 'Files' },
          { value: 'changelist', label: 'Changelists' },
        ]}
      />
    </ViewHeader>
  );
}
