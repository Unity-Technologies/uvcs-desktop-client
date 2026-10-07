import { SlidersHorizontal } from 'lucide-react';
import { openSettingsDialogAt } from '../../app/settings/SettingsDialog';
import { formatCount } from '../../lib/text';
import { IconButton } from '../../ui/IconButton';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { ViewHeader } from '../../ui/ViewHeader';
import { ReviewModeButton } from '../review/ReviewModeButton';
import { MyShelvesButton } from '../shelves/MyShelvesButton';
import type { ChangesGrouping } from './changeRows';
import { usePendingChangesViewStore } from './pendingChangesViewStore';
import { RefreshButton } from './RefreshButton';

interface PendingChangesHeaderProps {
  workspacePath: string;
  /** How many changes are pending; undefined until read. */
  pendingCount: number | undefined;
  /** Nothing is pending: no count and no ways to lay out a list that isn't there. */
  empty: boolean;
  fetching: boolean;
}

/** The Changes view's header: the count, how the list is grouped, and the view's buttons. The List/Tree switch is the filter bar's, as in every list of files. */
export function PendingChangesHeader({ workspacePath, pendingCount, empty, fetching }: PendingChangesHeaderProps) {
  const grouping = usePendingChangesViewStore((state) => state.grouping);
  const setGrouping = usePendingChangesViewStore((state) => state.setGrouping);
  return (
    <ViewHeader
      title="Changes"
      subtitle={pendingCount !== undefined && !empty && `${formatCount(pendingCount)} pending`}
      actions={
        <>
          <MyShelvesButton />
          <ReviewModeButton workspacePath={workspacePath} />
          <RefreshButton workspacePath={workspacePath} fetching={fetching} />
          <IconButton icon={<SlidersHorizontal size={14} />} label="What to show" onClick={() => openSettingsDialogAt('pendingChanges')} />
        </>
      }
    >
      {!empty && (
        <SegmentedControl<ChangesGrouping>
          value={grouping}
          onChange={setGrouping}
          segments={[
            { value: 'none', label: 'Files' },
            { value: 'changelist', label: 'Changelists' },
          ]}
        />
      )}
    </ViewHeader>
  );
}
