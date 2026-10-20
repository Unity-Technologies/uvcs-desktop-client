import { useEffect, useMemo, useState } from 'react';
import type { Changeset } from '@shared/domain/changeset';
import { avatarColumn, commentColumn, dateColumn, numberColumn } from '../../components/historyColumns';
import { EMPTY_SELECTION, singleSelection, type SelectionState } from '../../lib/selection';
import { EmptyState } from '../../ui/EmptyState';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { SplitPane } from '../../ui/SplitPane';
import type { Column } from '../../ui/table/column';
import { DataTable } from '../../ui/table/DataTable';
import { TableSkeleton } from '../../ui/table/TableSkeleton';
import { useChangesets } from '../changesets/useChangesets';
import { branchChangesetPane } from './branchChangesetPane';
import { DiffFrame } from './DiffFrame';
import { TargetDiff } from './TargetDiff';

type BranchDiffMode = 'wholeBranch' | 'byChangeset';

interface BranchDiffProps {
  branch: string;
  branchHead?: number;
  /** The file to open on, in the whole branch and in each of its changesets. */
  focusPath?: string;
}

/** A branch's changes, either all at once or one changeset at a time. */
export function BranchDiff({ branch, branchHead, focusPath }: BranchDiffProps) {
  const [mode, setMode] = useState<BranchDiffMode>('wholeBranch');
  const modeToggle = (
    <SegmentedControl<BranchDiffMode>
      value={mode}
      onChange={setMode}
      segments={[
        { value: 'wholeBranch', label: 'Whole branch' },
        { value: 'byChangeset', label: 'Changeset by changeset' },
      ]}
    />
  );

  if (mode === 'wholeBranch') return <TargetDiff target={{ kind: 'branch', branch }} branchHead={branchHead} toolbar={modeToggle} focusPath={focusPath} />;
  return <ChangesetByChangeset branch={branch} toolbar={modeToggle} focusPath={focusPath} />;
}

/** The Changesets view's columns that fit beside a diff; the avatar, whose tooltip names the author, always shows. */
const CHANGESET_COLUMNS: Column<Changeset>[] = [avatarColumn({ alwaysShown: true }), numberColumn('Changeset'), commentColumn(), dateColumn()];

/** Kept out of the render: a new `rowKey` makes the table key every changeset of the branch again on each step. */
const changesetKey = (changeset: Changeset): string => String(changeset.id);

function ChangesetByChangeset({ branch, toolbar, focusPath }: { branch: string; toolbar: React.ReactNode; focusPath?: string }) {
  const filter = useMemo(() => ({ branch }), [branch]);
  const { data: changesets, error } = useChangesets(filter);
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const selectedId = selection.anchor === null ? null : Number(selection.anchor);
  const firstId = changesets?.[0]?.id;

  useEffect(() => {
    if (selectedId === null && firstId !== undefined) setSelection(singleSelection(String(firstId)));
  }, [selectedId, firstId]);

  if (error) return <EmptyState title="Couldn't load the branch changesets" description={error.message} />;
  const pane = branchChangesetPane(changesets, selectedId);

  return (
    <SplitPane
      initialSize={380}
      minSize={220}
      maxSize={560}
      first={
        // The list's own column titles over placeholder rows while the changesets are read: the layout stays.
        changesets ? (
          <DataTable rows={changesets} columns={CHANGESET_COLUMNS} rowKey={changesetKey} selection={selection} onSelectionChange={setSelection} />
        ) : (
          <TableSkeleton columns={CHANGESET_COLUMNS} />
        )
      }
      second={
        // The mode switch stays in the diff's header while the changesets are read, and when there are none.
        pane.kind === 'reading' ? (
          <DiffFrame toolbar={toolbar}>{null}</DiffFrame>
        ) : pane.kind === 'noChangesets' ? (
          <DiffFrame toolbar={toolbar}>
            <EmptyState title="This branch has no changesets" />
          </DiffFrame>
        ) : (
          <TargetDiff target={{ kind: 'changeset', changesetId: pane.changesetId }} toolbar={toolbar} focusPath={focusPath} />
        )
      }
    />
  );
}
