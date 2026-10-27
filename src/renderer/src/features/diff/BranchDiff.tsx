import type { Changeset } from '@shared/domain/changeset';
import { useEffect, useMemo, useState } from 'react';
import type { FocusedLines } from '../../app/navigation/pages';
import { usePlace, useWorkspaceInfo } from '../../app/workspace/useWorkspace';
import type { MenuHost } from '../../components/menuWords';
import { branchWorkedOn } from '../../components/workingObject';
import { EMPTY_SELECTION, singleSelection, type SelectionState } from '../../lib/selection';
import { hotkey } from '../../lib/shortcutRegistry';
import { useShortcut } from '../../lib/useShortcut';
import { EmptyState } from '../../ui/EmptyState';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { changesetMenu } from '../changesets/changesetMenu';
import { useChangesets } from '../changesets/useChangesets';
import { changesetStep, filterBranchChangesets, showsChangesetList } from './changesetByChangeset';
import { BranchChangesetList } from './BranchChangesetList';
import { branchChangesetPane } from './branchChangesetPane';
import { DiffBrowserLayout } from './DiffBrowserLayout';
import { DiffFrame } from './DiffFrame';
import { TargetDiff } from './TargetDiff';

type BranchDiffMode = 'wholeBranch' | 'byChangeset';

interface BranchDiffProps {
  branch: string;
  branchHead?: number;
  /** The file to open on, in the whole branch and in each of its changesets. */
  focusPath?: string;
  focusLines?: FocusedLines;
}

/** A branch's changes, either all at once or one changeset at a time. */
export function BranchDiff({ branch, branchHead, focusPath, focusLines }: BranchDiffProps) {
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

  if (mode === 'wholeBranch') return <TargetDiff target={{ kind: 'branch', branch }} branchHead={branchHead} toolbar={modeToggle} focusPath={focusPath} focusLines={focusLines} />;
  return <ChangesetByChangeset branch={branch} toolbar={modeToggle} focusPath={focusPath} />;
}

/** The list binds no list keys: ⌘D and ⌘C reach the view under the page, ⇧⌘C copies the page's branch. */
const BRANCH_DIFF_HOST: MenuHost = { listKeysElsewhere: true };

function ChangesetByChangeset({ branch, toolbar, focusPath }: { branch: string; toolbar: React.ReactNode; focusPath?: string }) {
  const place = usePlace();
  const { data: workspace } = useWorkspaceInfo();
  const filter = useMemo(() => ({ branch }), [branch]);
  const { data: changesets, error } = useChangesets(filter);
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const [query, setQuery] = useState('');
  const [revealKey, setRevealKey] = useState<string | null>(null);
  const shown = useMemo(() => filterBranchChangesets(changesets ?? [], query), [changesets, query]);
  const selectedId = selection.anchor === null ? null : Number(selection.anchor);
  const firstId = changesets?.[0]?.id;
  // The changesets' own menu, as in the Changesets view: its Copy ▸ Link names the changeset stepped to.
  const menuContext = { place, loadedChangeset: workspace?.loadedChangeset, loadedBranch: branchWorkedOn(workspace?.selector) };

  useEffect(() => {
    if (selectedId === null && firstId !== undefined) setSelection(singleSelection(String(firstId)));
  }, [selectedId, firstId]);

  const stepsTo = (step: 1 | -1): number | null => (changesets ? changesetStep(changesets, shown, selectedId, step) : null);
  const stepTo = (step: 1 | -1): void => {
    const id = stepsTo(step);
    if (id === null) return;
    setSelection(singleSelection(String(id)));
    setRevealKey(String(id));
  };
  useShortcut(hotkey('nextChangeset'), () => stepTo(1));
  useShortcut(hotkey('previousChangeset'), () => stepTo(-1));

  if (error) return <EmptyState title="Couldn't load the branch changesets" description={error.message} />;
  const pane = branchChangesetPane(changesets, selectedId);
  const changesetList = showsChangesetList(changesets) && (
    <BranchChangesetList
      changesets={changesets}
      shown={shown}
      query={query}
      onQueryChange={setQuery}
      selection={selection}
      onSelectionChange={setSelection}
      stepsTo={stepsTo}
      onStep={stepTo}
      revealKey={revealKey}
      contextMenu={(rows: Changeset[]) => changesetMenu(menuContext, rows, BRANCH_DIFF_HOST)}
    />
  );

  // The changesets stay above the files as each changeset's diff is read (`DiffBrowserLayout`); the mode switch stays
  // in the header while the changesets are read, and when there are none.
  if (pane.kind === 'changeset') return <TargetDiff target={{ kind: 'changeset', changesetId: pane.changesetId }} toolbar={toolbar} focusPath={focusPath} aboveFiles={changesetList} />;
  return (
    <DiffFrame toolbar={toolbar}>
      {pane.kind === 'reading' ? <DiffBrowserLayout aboveFiles={changesetList} /> : <EmptyState title="This branch has no changesets" />}
    </DiffFrame>
  );
}
