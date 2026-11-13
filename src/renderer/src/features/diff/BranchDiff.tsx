import type { Changeset } from '@shared/domain/changeset';
import { Check, ChevronDown, Layers } from 'lucide-react';
import { useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ChangesetSpan, FocusedLines } from '../../app/navigation/pages';
import { usePlace, useWorkspaceInfo } from '../../app/workspace/useWorkspace';
import { ChangesetStepList } from '../../components/changesetList/ChangesetStepList';
import { changesetSpanSummary, type ChangesetSpanSummary } from '../../components/changesetList/changesetListChoice';
import type { ChangesetListFocus } from '../../components/changesetList/changesetStepListModel';
import { useChangesetStepList } from '../../components/changesetList/useChangesetStepList';
import type { MenuHost } from '../../components/menuWords';
import { branchWorkedOn } from '../../components/workingObject';
import { branchLabel } from '../../lib/branchLabels';
import { EmptyState } from '../../ui/EmptyState';
import { changesetMenu } from '../changesets/changesetMenu';
import { useChangesets } from '../changesets/useChangesets';
import { branchChangesetsFilter, branchDiffFocusFor, branchStartOfChangesets, initialBranchDiffFocus, showsChangesetList } from './branchDiffChangesets';
import { changesetMark, reviewedSeparator, type ReviewedUpTo } from './branchChangesetRows';
import { BranchDescription } from './BranchDescription';
import { askedOpen, changesetFoldLabel, changesetStepsWork, listIsOpen, toggledFold } from './changesetListFold';
import { useChangesetListFoldStore } from './changesetListFoldStore';
import { DiffBrowserLayout } from './DiffBrowserLayout';
import { DiffFocusRequestContext } from './diffFocusRequest';
import { DiffFrame } from './DiffFrame';
import { TargetDiff } from './TargetDiff';
import styles from './BranchDiff.module.css';

interface BranchDiffProps {
  branch: string;
  branchHead?: number;
  /** The file to open on, in all the branch's changes and in each of its changesets. */
  focusPath?: string;
  focusLines?: FocusedLines;
  /** Opens on this changeset (where a review's comment written there is). */
  focusChangeset?: number;
  /** Opens with every changeset of this span selected, as one diff (a review's new changesets). */
  focusChangesets?: ChangesetSpan;
  /** Where the user left off reviewing the branch (a code review's checkpoint): its changesets are marked new or reviewed. */
  reviewedUpTo?: ReviewedUpTo;
  /** After the diff's own controls in its header: the page's details toggle (a review's comments). */
  detailsToggle?: ReactNode;
}

/** The list binds no list keys: ⌘D and ⌘C reach the view under the page, ⇧⌘C copies the page's branch. */
const BRANCH_DIFF_HOST: MenuHost = { listKeysElsewhere: true };

/** The changesets shown before the rest scroll inside the list, under "All changes on …". */
const MOST_ROWS = 6;

/**
 * A branch's changes: all of them (`cm diff br:<branch> --integration`), one changeset's, or several changesets' as
 * one diff, picked in the list of its changesets above the files (`ChangesetStepList`), which opens on all of them.
 */
export function BranchDiff({ branch, branchHead, focusPath, focusLines, focusChangeset, focusChangesets, reviewedUpTo, detailsToggle }: BranchDiffProps) {
  const place = usePlace();
  const { data: workspace } = useWorkspaceInfo();
  const [focus, setFocus] = useState<ChangesetListFocus>(() => initialBranchDiffFocus(focusChangeset, focusChangesets));
  // Folded, the list is one line and its changesets aren't read (`ChangesetListFold`).
  const remembered = useChangesetListFoldStore((state) => state.open);
  const setRemembered = useChangesetListFoldStore((state) => state.setOpen);
  const [asked, setAsked] = useState(() => askedOpen(focus));
  const fold = { remembered, asked };
  const open = listIsOpen(fold);
  const toggleFold = (): void => {
    const next = toggledFold(fold);
    setRemembered(next.fold.remembered);
    setAsked(next.fold.asked);
    if (next.showsAll) setFocus({ kind: 'all' });
  };
  const filter = useMemo(() => branchChangesetsFilter(branch), [branch]);
  const { data: changesets, error } = useChangesets(filter, { enabled: open });
  // The place asks for changesets, with a file or not (a review's comment, where it was written; a check-in; what's
  // new since the user's review): select them.
  const focusRequest = useContext(DiffFocusRequestContext);
  useEffect(() => {
    const askedFocus = branchDiffFocusFor(focusRequest);
    if (!askedFocus) return;
    setFocus(askedFocus);
    if (askedOpen(askedFocus)) setAsked(true);
  }, [focusRequest?.seq]);
  const list = useChangesetStepList({ changesets, focus, allApart: true, stepsEnabled: changesetStepsWork(open, changesets) });

  // The changesets' own menu, as in the Changesets view: its Copy ▸ Link names the changeset. The whole branch read
  // tells where it starts, for the branch diff up to a changeset.
  const start = branchStartOfChangesets(branch, changesets);
  const menuContext = {
    place,
    loadedChangeset: workspace?.loadedChangeset,
    loadedBranch: branchWorkedOn(workspace?.selector),
    branchStartOf: (name: string) => (name === branch ? start : null),
  };
  const quiet = useCallback((changeset: Changeset) => changesetMark(changeset, reviewedUpTo) === 'reviewed', [reviewedUpTo]);
  const separator = useMemo(() => reviewedSeparator(list.shown, reviewedUpTo, Date.now()), [list.shown, reviewedUpTo]);

  // Without its changesets, the branch's diff still shows all its changes, or one changeset asked for by its number.
  if (error && list.choice.kind === 'reading') return <EmptyState title="Couldn't load the branch changesets" description={error.message} />;
  // "Show the 3 new" on the Reviewed line; "3 new" on the folded All changes row (a review's page has read its changesets).
  const showNewButton = (label: string) =>
    separator && (
      <button
        type="button"
        className={styles.showNew}
        data-tip={label === separator.showNew.label ? undefined : separator.showNew.label}
        onClick={() => {
          setFocus({ kind: 'span', span: separator.showNew.span });
          setAsked(true);
        }}
      >
        {label}
      </button>
    );
  const showNew = separator && showNewButton(separator.showNew.label);
  const changesetList = !error && showsChangesetList(changesets) && (
    <ChangesetFold
      allChanges={{ label: `All changes on ${branchLabel(branch)}`, tip: branch }}
      selected={list.choice.kind === 'all'}
      onSelectAll={() => setFocus({ kind: 'all' })}
      foldLabel={changesetFoldLabel(open)}
      open={open}
      onToggle={toggleFold}
      folded={separator && showNewButton(separator.showNew.short)}
    >
      <ChangesetStepList
        list={list}
        allChanges={{ label: `All changes on ${branchLabel(branch)}`, tip: branch }}
        quiet={reviewedUpTo && quiet}
        separator={
          separator && {
            beforeKey: separator.beforeKey,
            content: (
              <span className={styles.reviewed}>
                <span className={styles.reviewedBy} data-tip={separator.tip}>
                  <Check size={12} aria-hidden />
                  {separator.label}
                </span>
                {showNew}
              </span>
            ),
          }
        }
        mostRows={MOST_ROWS}
        label="Changesets"
        contextMenu={(rows) => changesetMenu(menuContext, rows, BRANCH_DIFF_HOST)}
      />
    </ChangesetFold>
  );

  // The changesets stay above the files as each diff is read (`DiffBrowserLayout`), and the header's one line names
  // what is read on the branch ("Changes in cs:1234 on task"): a changeset's summary, as tall as its comment, goes
  // above its diff, where its height moves nothing being clicked.
  const toolbar = detailsToggle;
  const { choice } = list;
  const branchDescription = <BranchDescription branch={branch} choice={choice} />;
  if (choice.kind === 'all') {
    return <TargetDiff target={{ kind: 'branch', branch }} branchHead={branchHead} toolbar={toolbar} focusPath={focusPath} focusLines={focusLines} aboveFiles={changesetList} />;
  }
  const changesetFocusPath = focusRequest?.path ?? focusPath;
  if (choice.kind === 'changeset') {
    return (
      <TargetDiff
        target={{ kind: 'changeset', changesetId: choice.changesetId }}
        toolbar={toolbar}
        focusPath={changesetFocusPath}
        aboveFiles={changesetList}
        pageDescription={branchDescription}
      />
    );
  }
  if (choice.kind === 'span') {
    return (
      <TargetDiff
        target={choice.target}
        toolbar={toolbar}
        focusPath={changesetFocusPath}
        aboveFiles={changesetList}
        pageDescription={branchDescription}
        description={<ChangesetSpanDescription summary={changesetSpanSummary(choice.changesets)} />}
      />
    );
  }
  return (
    <DiffFrame description={branchDescription} toolbar={toolbar}>
      <DiffBrowserLayout aboveFiles={changesetList} />
    </DiffFrame>
  );
}

/**
 * The changesets above the files, under the row that stands for them all, "All changes on task", which folds them
 * (its end, "Changesets ⌄", a word that stays as they're read; how many is the filter's, once open): who reviews the
 * whole branch sees that row only, selected while the diff shows all the changes, with "3 new" on a review's page
 * (`folded`). The row stays in its place as the list opens under it, and stands apart from the list (`allApart`), so
 * the filter never hides it. The list mounts only open, so folded it reads nothing.
 */
function ChangesetFold(props: {
  allChanges: { label: string; tip: string };
  selected: boolean;
  onSelectAll: () => void;
  foldLabel: string;
  open: boolean;
  onToggle: () => void;
  folded?: ReactNode;
  children: ReactNode;
}) {
  const { allChanges, selected, onSelectAll, foldLabel, open, onToggle, folded, children } = props;
  return (
    <div className={styles.fold} data-open={open || undefined}>
      <div className={styles.allRow} data-selected={selected || undefined}>
        <button type="button" className={styles.allButton} aria-pressed={selected} data-tip={allChanges.tip} onClick={onSelectAll}>
          <Layers size={14} className={styles.allIcon} aria-hidden />
          <span className={styles.allLabel}>{allChanges.label}</span>
        </button>
        {!open && folded}
        <button type="button" className={styles.foldToggle} aria-expanded={open} data-tip={foldLabel} onClick={onToggle}>
          Changesets
          <ChevronDown size={14} className={styles.foldChevron} aria-hidden />
        </button>
      </div>
      {open && children}
    </div>
  );
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
