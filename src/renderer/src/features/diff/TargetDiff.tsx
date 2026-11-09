import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { DiffTarget } from '@shared/domain/diff';
import type { DiffSideName, FocusedLines } from '../../app/navigation/pages';
import { EmptyState } from '../../ui/EmptyState';
import { usePlace } from '../../app/workspace/useWorkspace';
import { ChangesetSummary } from '../changesets/ChangesetSummary';
import { useChangeset } from '../changesets/useChangeset';
import { useCachedShelve } from '../shelves/cachedShelve';
import { ShelveSummary } from '../shelves/ShelveSummary';
import { DiffBrowser } from './DiffBrowser';
import { DiffBrowserLayout } from './DiffBrowserLayout';
import { BranchDescription } from './BranchDescription';
import { DiffFrame } from './DiffFrame';
import { DiffHeader } from './DiffHeader';
import { useDiffEntries } from './useDiffEntries';
import styles from './TargetDiff.module.css';

/** The files that differ for a target, under a header describing what is being compared. */
interface TargetDiffProps {
  target: DiffTarget;
  toolbar?: ReactNode;
  focusPath?: string;
  /** With `focusPath`: the file opens scrolled to these lines, selected (a link's `#L42`). */
  focusLines?: FocusedLines;
  /** For a branch, the head it's diffed at (see `useDiffEntries`). */
  branchHead?: number;
  /** For a range, its sides named where their specs don't say what they are (two branches' heads). */
  sideNames?: readonly [DiffSideName, DiffSideName];
  /** Above the files, staying as the target changes: a branch's changesets, stepped through one at a time. */
  aboveFiles?: ReactNode;
  /**
   * What the page's header describes instead of the target, which is then described above the diff: a branch, its
   * changesets stepped through. A changeset's summary changes height with its comment; over the whole page it would
   * move the lists being stepped through.
   */
  pageDescription?: ReactNode;
}

export function TargetDiff({ target, toolbar, focusPath, focusLines, branchHead, sideNames, aboveFiles, pageDescription }: TargetDiffProps) {
  const { data: entries, error } = useDiffEntries(target, { branchHead });
  // Keyed so another changeset (Branch diff's "By changeset") folds its own comment afresh (`FoldedComment`).
  const description = <TargetDescription key={JSON.stringify(target)} target={target} sideNames={sideNames} />;

  return (
    <DiffFrame description={pageDescription ?? description} toolbar={toolbar}>
      <DiffBrowserLayout aboveFiles={aboveFiles} aboveDiff={pageDescription && <DiffHeader description={description} />}>
        {(slots) =>
          // Beside the files' column, which stays empty: what's above it (a branch's changesets) can still be stepped.
          error ? (
            createPortal(<EmptyState title="Couldn't calculate the differences" description={error.message} />, slots.diff)
          ) : (
            <DiffBrowser key={JSON.stringify(target)} target={target} entries={entries} initialPath={focusPath} initialLines={focusLines} slots={slots} />
          )
        }
      </DiffBrowserLayout>
    </DiffFrame>
  );
}

function TargetDescription({ target, sideNames }: { target: DiffTarget; sideNames?: readonly [DiffSideName, DiffSideName] }) {
  switch (target.kind) {
    case 'changeset':
      return <ChangesetDescription changesetId={target.changesetId} />;
    case 'range': {
      const [from, to] = sideNames ?? [{ label: target.fromSpec }, { label: target.toSpec }];
      return (
        <div className={styles.title}>
          Changes from <code data-tip={from.tooltip}>{from.label}</code> to <code data-tip={to.tooltip}>{to.label}</code>
        </div>
      );
    }
    case 'branch':
      return <BranchDescription branch={target.branch} />;
    case 'shelve':
      return <ShelveDescription shelveId={target.shelveId} />;
  }
}

function ShelveDescription({ shelveId }: { shelveId: number }) {
  const shelve = useCachedShelve(usePlace(), shelveId);
  return shelve ? <ShelveSummary shelve={shelve} /> : <div className={styles.title}>Shelve {shelveId}</div>;
}

function ChangesetDescription({ changesetId }: { changesetId: number }) {
  const { data: changeset } = useChangeset(changesetId);
  return changeset ? <ChangesetSummary changeset={changeset} /> : <div className={styles.title}>Changeset {changesetId}</div>;
}
