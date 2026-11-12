import type { Changeset } from '@shared/domain/changeset';
import { useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ChangesetSpan, FocusedLines } from '../../app/navigation/pages';
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
import { branchDiffShownFor, branchStartOfChangesets, changesetStep, oldestFirst, shownBranchChangesets, selectedChangesetIds, showsChangesetList, spanSelection, type BranchDiffMode, type ChangesetToShow, type SpanToShow } from './changesetByChangeset';
import { newChangesetsOf, type ReviewedUpTo } from './branchChangesetRows';
import { BranchChangesetList } from './BranchChangesetList';
import { BranchDescription } from './BranchDescription';
import { branchChangesetPane, changesetSpanSummary, type ChangesetSpanSummary } from './branchChangesetPane';
import { DiffBrowserLayout } from './DiffBrowserLayout';
import { DiffFocusRequestContext } from './diffFocusRequest';
import { DiffFrame } from './DiffFrame';
import { TargetDiff } from './TargetDiff';
import styles from './BranchDiff.module.css';

interface BranchDiffProps {
  branch: string;
  branchHead?: number;
  /** The file to open on, in the whole branch and in each of its changesets. */
  focusPath?: string;
  focusLines?: FocusedLines;
  /** Opens changeset by changeset, on this changeset (where a review's comment written there is). */
  focusChangeset?: number;
  /** Opens changeset by changeset, every changeset of this span selected, as one diff (a review's new changesets). */
  focusChangesets?: ChangesetSpan;
  /** Where the user left off reviewing the branch (a code review's checkpoint): its changesets are marked new or reviewed. */
  reviewedUpTo?: ReviewedUpTo;
  /** After the diff's own controls in its header: the page's details toggle (a review's comments). */
  detailsToggle?: ReactNode;
}

/** A branch's changes, either all at once or one changeset at a time. */
export function BranchDiff({ branch, branchHead, focusPath, focusLines, focusChangeset, focusChangesets, reviewedUpTo, detailsToggle }: BranchDiffProps) {
  const [mode, setMode] = useState<BranchDiffMode>(focusChangeset === undefined && focusChangesets === undefined ? 'wholeBranch' : 'byChangeset');
  // The changeset asked for, again each time it's asked (`seq`): the user may have stepped elsewhere meanwhile.
  const [stepTo, setStepTo] = useState<ChangesetToShow | undefined>(focusChangeset === undefined ? undefined : { changesetId: focusChangeset, seq: 0 });
  const [spanTo, setSpanTo] = useState<SpanToShow | undefined>(focusChangesets === undefined ? undefined : { changesets: focusChangesets, seq: 0 });
  // The place asks for a mode, with a file or not (a review's comment, in the mode it was written in; a check-in; what's
  // new since the user's review): switch to it.
  const focusRequest = useContext(DiffFocusRequestContext);
  useEffect(() => {
    const shown = branchDiffShownFor(focusRequest);
    if (!shown) return;
    setMode(shown.mode);
    if (shown.changeset) setStepTo(shown.changeset);
    if (shown.span) setSpanTo(shown.span);
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
  return (
    <ChangesetByChangeset
      branch={branch}
      toolbar={modeToggle}
      focusPath={focusRequest?.path ?? focusPath}
      focusChangeset={stepTo}
      focusChangesets={spanTo}
      reviewedUpTo={reviewedUpTo}
    />
  );
}

/** The list binds no list keys: ⌘D and ⌘C reach the view under the page, ⇧⌘C copies the page's branch. */
const BRANCH_DIFF_HOST: MenuHost = { listKeysElsewhere: true };

interface ChangesetByChangesetProps {
  branch: string;
  toolbar: ReactNode;
  focusPath?: string;
  /** The changeset to show, selected as it opens and each time it's asked for. */
  focusChangeset?: ChangesetToShow;
  /** The span to show, its changesets selected as it opens and each time another is asked for. */
  focusChangesets?: SpanToShow;
  reviewedUpTo?: ReviewedUpTo;
}

function ChangesetByChangeset({ branch, toolbar, focusPath, focusChangeset, focusChangesets, reviewedUpTo }: ChangesetByChangesetProps) {
  const place = usePlace();
  const { data: workspace } = useWorkspaceInfo();
  const filter = useMemo(() => ({ branch }), [branch]);
  const { data: changesets, error } = useChangesets(filter);
  const [selection, setSelection] = useState<SelectionState>(() => initialSelection(changesets, focusChangeset, focusChangesets));
  const [query, setQuery] = useState('');
  const [onlyNew, setOnlyNew] = useState(false);
  const [revealKey, setRevealKey] = useState<string | null>(null);
  // Oldest on top, as the branch was built (`oldestFirst`); the read stays newest first for what asks for the newest.
  const listed = useMemo(() => oldestFirst(changesets ?? []), [changesets]);
  const shown = useMemo(() => shownBranchChangesets(listed, { query, onlyNew }, reviewedUpTo), [listed, query, onlyNew, reviewedUpTo]);
  const newCount = useMemo(() => newChangesetsOf(changesets ?? [], reviewedUpTo).length, [changesets, reviewedUpTo]);
  const selectedId = selection.anchor === null ? null : Number(selection.anchor);
  // The newest, at the list's bottom: selected first, and brought into view.
  const newestId = changesets?.[0]?.id;
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
    if (selectedId === null && newestId !== undefined) {
      setSelection(singleSelection(String(newestId)));
      setRevealKey(String(newestId));
    }
  }, [selectedId, newestId]);
  useEffect(() => {
    if (focusChangeset === undefined) return;
    setSelection(singleSelection(String(focusChangeset.changesetId)));
    setRevealKey(String(focusChangeset.changesetId));
  }, [focusChangeset?.changesetId, focusChangeset?.seq]);
  // Every changeset of the span once they're read; its ends until then, which show the same diff.
  const read = changesets !== undefined;
  useEffect(() => {
    if (focusChangesets === undefined) return;
    setSelection(spanSelection(changesets, focusChangesets.changesets));
    setRevealKey(String(focusChangesets.changesets.newest));
  }, [focusChangesets?.seq, read]);

  const stepsTo = (step: 1 | -1): number | null => (changesets ? changesetStep(listed, shown, selectedId, step) : null);
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
  const pane = branchChangesetPane(changesets, selectedChangesetIds(selection));
  const changesetList = showsChangesetList(changesets) && (
    <BranchChangesetList
      changesets={changesets}
      shown={shown}
      query={query}
      onQueryChange={setQuery}
      reviewedUpTo={reviewedUpTo}
      newCount={newCount}
      onlyNew={onlyNew}
      onOnlyNewChange={setOnlyNew}
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
  if (pane.kind === 'span') {
    return (
      <TargetDiff
        target={pane.target}
        toolbar={toolbar}
        focusPath={focusPath}
        aboveFiles={changesetList}
        pageDescription={branchDescription}
        description={<ChangesetSpanDescription summary={changesetSpanSummary(pane.changesets)} />}
      />
    );
  }
  return (
    <DiffFrame description={branchDescription} toolbar={toolbar}>
      {pane.kind === 'reading' ? <DiffBrowserLayout aboveFiles={changesetList} /> : <EmptyState title="This branch has no changesets" />}
    </DiffFrame>
  );
}

function initialSelection(changesets: readonly Changeset[] | undefined, focusChangeset: ChangesetToShow | undefined, focusChangesets: SpanToShow | undefined): SelectionState {
  if (focusChangesets) return spanSelection(changesets, focusChangesets.changesets);
  return focusChangeset === undefined ? EMPTY_SELECTION : singleSelection(String(focusChangeset.changesetId));
}

/** Where one changeset's summary sits above its diff: "3 changesets · cs:15 to cs:17 · Daniel". */
function ChangesetSpanDescription({ summary }: { summary: ChangesetSpanSummary }) {
  return (
    <div className={styles.span}>
      <span className={styles.spanCount}>{summary.count}</span>
      <span aria-hidden>·</span>
      <span className="mono">{summary.ends}</span>
      <span aria-hidden>·</span>
      <span className={styles.spanAuthors}>{summary.authors}</span>
    </div>
  );
}
