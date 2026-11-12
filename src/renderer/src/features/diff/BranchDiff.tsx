import type { Changeset } from '@shared/domain/changeset';
import { Check, ChevronRight } from 'lucide-react';
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
import { askedOpen, changesetFoldLabel, listIsOpen, toggledFold } from './changesetListFold';
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
  const list = useChangesetStepList({ changesets, focus });

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
  // "Show the 3 new": on the Reviewed line, and on the folded line too (a review's page has read its changesets).
  const showNew = separator && (
    <button
      type="button"
      className={styles.showNew}
      onClick={() => {
        setFocus({ kind: 'span', span: separator.showNew.span });
        setAsked(true);
      }}
    >
      {separator.showNew.label}
    </button>
  );
  const changesetList = !error && showsChangesetList(changesets) && (
    <ChangesetFold label={changesetFoldLabel(changesets?.length)} open={open} onToggle={toggleFold} folded={showNew}>
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

  // The changesets stay above the files as each diff is read (`DiffBrowserLayout`), and the header names the branch
  // whatever is read: a changeset's summary, as tall as its comment, goes above its diff, where its height moves
  // nothing being clicked.
  const toolbar = detailsToggle;
  const branchDescription = <BranchDescription branch={branch} />;
  const { choice } = list;
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
 * The changesets above the files, folding to one line ("Changesets · 13 ›") that opens them: who reviews the whole
 * branch sees that line only, with "Show the 3 new" at its end on a review's page (`folded`). The list mounts only
 * open, so folded it reads nothing.
 */
function ChangesetFold({ label, open, onToggle, folded, children }: { label: string; open: boolean; onToggle: () => void; folded?: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.fold} data-open={open || undefined}>
      <div className={styles.foldBar}>
        <button type="button" className={styles.foldLine} aria-expanded={open} onClick={onToggle}>
          <ChevronRight size={14} className={styles.foldChevron} aria-hidden />
          {label}
        </button>
        {!open && folded}
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
