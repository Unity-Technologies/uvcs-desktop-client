import type { ReactNode } from 'react';
import type { DiffTarget } from '@shared/domain/diff';
import type { DiffSideName, FocusedLines } from '../../app/navigation/pages';
import { EmptyState } from '../../ui/EmptyState';
import { usePlace } from '../../app/workspace/useWorkspace';
import { PathLabel } from '../../components/PathLabel';
import { ChangesetSummary } from '../changesets/ChangesetSummary';
import { useChangeset } from '../changesets/useChangeset';
import { cachedShelve } from '../shelves/cachedShelve';
import { ShelveSummary } from '../shelves/ShelveSummary';
import { DiffBrowser } from './DiffBrowser';
import { DiffFrame } from './DiffFrame';
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
}

export function TargetDiff({ target, toolbar, focusPath, focusLines, branchHead, sideNames }: TargetDiffProps) {
  const { data: entries, error } = useDiffEntries(target, { branchHead });

  return (
    <DiffFrame
      // Keyed so another changeset (Branch diff's "By changeset") folds its own comment afresh (`FoldedComment`).
      description={<TargetDescription key={JSON.stringify(target)} target={target} sideNames={sideNames} />}
      toolbar={toolbar}
    >
      {error ? (
        <EmptyState title="Couldn't calculate the differences" description={error.message} />
      ) : (
        <DiffBrowser key={JSON.stringify(target)} target={target} entries={entries} initialPath={focusPath} initialLines={focusLines} />
      )}
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
      return (
        <div className={styles.branchTitle}>
          <span>All changes on</span>
          <PathLabel path={target.branch} fitContent />
        </div>
      );
    case 'shelve':
      return <ShelveDescription shelveId={target.shelveId} />;
  }
}

function ShelveDescription({ shelveId }: { shelveId: number }) {
  const shelve = cachedShelve(usePlace(), shelveId);
  return shelve ? <ShelveSummary shelve={shelve} /> : <div className={styles.title}>Shelve {shelveId}</div>;
}

function ChangesetDescription({ changesetId }: { changesetId: number }) {
  const { data: changeset } = useChangeset(changesetId);
  return changeset ? <ChangesetSummary changeset={changeset} /> : <div className={styles.title}>Changeset {changesetId}</div>;
}
