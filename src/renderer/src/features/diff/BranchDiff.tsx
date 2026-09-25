import { useEffect, useMemo, useState } from 'react';
import type { Changeset } from '@shared/domain/changeset';
import { EMPTY_SELECTION, type SelectionState } from '../../lib/selection';
import { firstLine } from '../../lib/text';
import { EmptyState } from '../../ui/EmptyState';
import { RelativeTime } from '../../ui/RelativeTime';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { CenteredSpinner } from '../../ui/Spinner';
import { SplitPane } from '../../ui/SplitPane';
import { DataTable, type Column } from '../../ui/table/DataTable';
import { useChangesets } from '../changesets/useChangesets';
import { TargetDiff } from './TargetDiff';

type BranchDiffMode = 'wholeBranch' | 'byChangeset';

/** A branch's changes, either all at once or one changeset at a time. */
export function BranchDiff({ branch }: { branch: string }) {
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

  if (mode === 'wholeBranch') return <TargetDiff target={{ kind: 'branch', branch }} toolbar={modeToggle} />;
  return <ChangesetByChangeset branch={branch} toolbar={modeToggle} />;
}

const CHANGESET_COLUMNS: Column<Changeset>[] = [
  { id: 'id', header: 'Cs', width: 56, secondary: true, render: (changeset) => changeset.id },
  { id: 'comment', header: 'Comment', render: (changeset) => firstLine(changeset.comment) || '—' },
  { id: 'date', header: 'Date', width: 110, secondary: true, render: (changeset) => <RelativeTime date={changeset.date} /> },
];

function ChangesetByChangeset({ branch, toolbar }: { branch: string; toolbar: React.ReactNode }) {
  const filter = useMemo(() => ({ branch }), [branch]);
  const { data: changesets, error } = useChangesets(filter);
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const selectedId = selection.anchor === null ? null : Number(selection.anchor);
  const firstId = changesets?.[0]?.id;

  useEffect(() => {
    if (selectedId === null && firstId !== undefined) setSelection({ selected: new Set([String(firstId)]), anchor: String(firstId) });
  }, [selectedId, firstId]);

  if (error) return <EmptyState title="Couldn't load the branch changesets" description={error.message} />;
  if (!changesets) return <CenteredSpinner />;

  return (
    <SplitPane
      initialSize={320}
      minSize={220}
      maxSize={560}
      first={
        <DataTable
          rows={changesets}
          columns={CHANGESET_COLUMNS}
          rowKey={(changeset) => String(changeset.id)}
          selection={selection}
          onSelectionChange={setSelection}
        />
      }
      second={
        selectedId === null ? (
          <EmptyState title="This branch has no changesets" />
        ) : (
          <TargetDiff target={{ kind: 'changeset', changesetId: selectedId }} toolbar={toolbar} />
        )
      }
    />
  );
}
