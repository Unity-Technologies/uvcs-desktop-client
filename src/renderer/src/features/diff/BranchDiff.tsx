import type { Changeset } from '@shared/domain/changeset';
import { useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { branchStartOfChangesets, changesetStep, filterBranchChangesets, showsChangesetList } from './changesetByChangeset';
import { BranchChangesetList } from './BranchChangesetList';
import { BranchDescription } from './BranchDescription';
import { branchChangesetPane } from './branchChangesetPane';
import { DiffBrowserLayout } from './DiffBrowserLayout';
import { DiffFocusRequestContext } from './diffFocusRequest';
import { DiffFrame } from './DiffFrame';
import { TargetDiff } from './TargetDiff';

type BranchDiffMode = 'wholeBranch' | 'byChangeset';

interface BranchDiffProps {
  branch: string;
  branchHead?: number;
  /** The file to open on, in the whole branch and in each of its changesets. */
  focusPath?: string;
  focusLines?: FocusedLines;
  /** Opens changeset by changeset, on this changeset (where a review's comment written there is). */
  focusChangeset?: number;
  /** After the diff's own controls in its header: the page's details toggle (a review's comments). */
  detailsToggle?: ReactNode;
}

/** A branch's changes, either all at once or one changeset at a time. */
export function BranchDiff({ branch, branchHead, focusPath, focusLines, focusChangeset, detailsToggle }: BranchDiffProps) {
  const [mode, setMode] = useState<BranchDiffMode>(focusChangeset === undefined ? 'wholeBranch' : 'byChangeset');
  const [stepTo, setStepTo] = useState<number | undefined>(focusChangeset);
  // The place asks for a file in a mode (a review's comment, in the mode it was written in): switch to it.
  const focusRequest = useContext(DiffFocusRequestContext);
  useEffect(() => {
    if (focusRequest?.changesetId === undefined) return;
    setMode(focusRequest.changesetId === null ? 'wholeBranch' : 'byChangeset');
    if (focusRequest.changesetId !== null) setStepTo(focusRequest.changesetId);
  }, [focusRequest?.seq]);
  const modeToggle = (
    <>
      <SegmentedControl<BranchDiffMode>
        value={mode}
        onChange={setMode}
        segments={[
          { value: 'wholeBranch', label: 'Whole branch' },
          { value: 'byChangeset', label: 'Changeset by changeset' },
        ]}
      />
      {detailsToggle}
    </>
  );

  if (mode === 'wholeBranch') return <TargetDiff target={{ kind: 'branch', branch }} branchHead={branchHead} toolbar={modeToggle} focusPath={focusPath} focusLines={focusLines} />;
  return <ChangesetByChangeset branch={branch} toolbar={modeToggle} focusPath={focusRequest?.path ?? focusPath} focusChangeset={stepTo} />;
}

/** The list binds no list keys: ⌘D and ⌘C reach the view under the page, ⇧⌘C copies the page's branch. */
const BRANCH_DIFF_HOST: MenuHost = { listKeysElsewhere: true };

interface ChangesetByChangesetProps {
  branch: string;
  toolbar: ReactNode;
  focusPath?: string;
  /** The changeset to show, selected as it opens and each time another is asked for. */
  focusChangeset?: number;
}

function ChangesetByChangeset({ branch, toolbar, focusPath, focusChangeset }: ChangesetByChangesetProps) {
  const place = usePlace();
  const { data: workspace } = useWorkspaceInfo();
  const filter = useMemo(() => ({ branch }), [branch]);
  const { data: changesets, error } = useChangesets(filter);
  const [selection, setSelection] = useState<SelectionState>(() => (focusChangeset === undefined ? EMPTY_SELECTION : singleSelection(String(focusChangeset))));
  const [query, setQuery] = useState('');
  const [revealKey, setRevealKey] = useState<string | null>(null);
  const shown = useMemo(() => filterBranchChangesets(changesets ?? [], query), [changesets, query]);
  const selectedId = selection.anchor === null ? null : Number(selection.anchor);
  const firstId = changesets?.[0]?.id;
  // The changesets' own menu, as in the Changesets view: its Copy ▸ Link names the changeset stepped to. The whole
  // branch read tells where it starts, for the branch diff up to a changeset.
  const start = branchStartOfChangesets(branch, changesets);
  const menuContext = {
    place,
    loadedChangeset: workspace?.loadedChangeset,
    loadedBranch: branchWorkedOn(workspace?.selector),
    branchStartOf: (name: string) => (name === branch ? start : null),
  };

  useEffect(() => {
    if (selectedId === null && firstId !== undefined) setSelection(singleSelection(String(firstId)));
  }, [selectedId, firstId]);
  useEffect(() => {
    if (focusChangeset === undefined) return;
    setSelection(singleSelection(String(focusChangeset)));
    setRevealKey(String(focusChangeset));
  }, [focusChangeset]);

  const stepsTo = (step: 1 | -1): number | null => (changesets ? changesetStep(changesets, shown, selectedId, step) : null);
  const stepTo = (step: 1 | -1): void => {
    const id = stepsTo(step);
    if (id === null) return;
    setSelection(singleSelection(String(id)));
    setRevealKey(String(id));
  };
  // Not from a text field: ⌥⇧↓ ⌥⇧↑ select to the text's ends on macOS (the filters'); the diff's step keys do the same.
  useShortcut(hotkey('nextChangeset'), () => stepTo(1), true, { whileTyping: false });
  useShortcut(hotkey('previousChangeset'), () => stepTo(-1), true, { whileTyping: false });

  if (error) return <EmptyState title="Couldn't load the branch changesets" description={error.message} />;
  const pane = branchChangesetPane(changesets, selectedId);
  const changesetList = showsChangesetList(changesets) && (
    <BranchChangesetList
      changesets={changesets}
      shown={shown}
      query={query}
      onQueryChange={setQuery}
      selection={selection}
      onSelectionChange={(next) => {
        // A changeset picked in the list is already in view; the one stepped to before isn't revealed again.
        setRevealKey(null);
        setSelection(next);
      }}
      stepsTo={stepsTo}
      onStep={stepTo}
      revealKey={revealKey}
      contextMenu={(rows: Changeset[]) => changesetMenu(menuContext, rows, BRANCH_DIFF_HOST)}
    />
  );

  // The changesets stay above the files as each changeset's diff is read (`DiffBrowserLayout`), and the header names
  // the branch, as in "Whole branch", whatever is read: each changeset's summary, as tall as its comment, goes above
  // its diff, where its height moves nothing being clicked.
  const branchDescription = <BranchDescription branch={branch} />;
  if (pane.kind === 'changeset') {
    return (
      <TargetDiff
        target={{ kind: 'changeset', changesetId: pane.changesetId }}
        toolbar={toolbar}
        focusPath={focusPath}
        aboveFiles={changesetList}
        pageDescription={branchDescription}
      />
    );
  }
  return (
    <DiffFrame description={branchDescription} toolbar={toolbar}>
      {pane.kind === 'reading' ? <DiffBrowserLayout aboveFiles={changesetList} /> : <EmptyState title="This branch has no changesets" />}
    </DiffFrame>
  );
}
