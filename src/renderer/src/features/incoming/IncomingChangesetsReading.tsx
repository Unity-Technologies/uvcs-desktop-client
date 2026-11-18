import { ChangesetFold } from '../../components/changesetList/ChangesetFold';
import { changesetFoldLabel } from '../../components/changesetList/changesetListFold';
import { ChangesetStepList } from '../../components/changesetList/ChangesetStepList';
import { CHANGESET_LIST_MOST_ROWS, type ChangesetListFocus } from '../../components/changesetList/changesetStepListModel';
import { useChangesetStepList } from '../../components/changesetList/useChangesetStepList';
import { ALL_INCOMING_ROW } from './IncomingChangesetList';
import { useIncomingViewStore } from './incomingViewStore';

const ALL: ChangesetListFocus = { kind: 'all' };

/**
 * The changesets' place while Incoming checks: the All incoming changes row and, open, the list's own skeleton
 * (`ChangesetStepList` with no changesets yet), so nothing moves once they're in.
 */
export function IncomingChangesetsReading() {
  const open = !useIncomingViewStore((state) => state.changesetsCollapsed);
  const toggle = useIncomingViewStore((state) => state.toggleChangesets);
  const list = useChangesetStepList({ changesets: undefined, focus: ALL, stepsEnabled: false });
  return (
    <ChangesetFold allChanges={ALL_INCOMING_ROW} selected onSelectAll={() => undefined} foldLabel={changesetFoldLabel(open)} open={open} onToggle={toggle}>
      <ChangesetStepList list={list} mostRows={CHANGESET_LIST_MOST_ROWS} label="Incoming changesets" contextMenu={() => []} />
    </ChangesetFold>
  );
}
