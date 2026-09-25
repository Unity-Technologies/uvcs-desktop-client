import type { ReactNode } from 'react';
import type { DiffTarget } from '@shared/domain/diff';
import { EmptyState } from '../../ui/EmptyState';
import { CenteredSpinner } from '../../ui/Spinner';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { ChangesetSummary } from '../changesets/ChangesetSummary';
import { useChangeset } from '../changesets/useChangeset';
import { ReviewModeButton } from '../review/ReviewModeButton';
import { DiffBrowser } from './DiffBrowser';
import { useDiffEntries } from './useDiffEntries';
import styles from './TargetDiff.module.css';

/** The files that differ for a target, under a header describing what is being compared. */
interface TargetDiffProps {
  target: DiffTarget;
  toolbar?: ReactNode;
  focusPath?: string;
  /** For a branch, the head it's diffed at (see `useDiffEntries`). */
  branchHead?: number;
}

export function TargetDiff({ target, toolbar, focusPath, branchHead }: TargetDiffProps) {
  const workspacePath = useWorkspacePath();
  const { data: entries, error } = useDiffEntries(target, { branchHead });

  return (
    <div className={styles.diff}>
      <header className={styles.header}>
        <div className={styles.description}>
          <TargetDescription target={target} />
        </div>
        {toolbar}
        <ReviewModeButton workspacePath={workspacePath} />
      </header>
      {error ? (
        <EmptyState title="Couldn't calculate the differences" description={error.message} />
      ) : entries ? (
        <DiffBrowser key={JSON.stringify(target)} target={target} entries={entries} initialPath={focusPath} />
      ) : (
        <CenteredSpinner />
      )}
    </div>
  );
}

function TargetDescription({ target }: { target: DiffTarget }) {
  switch (target.kind) {
    case 'changeset':
      return <ChangesetDescription changesetId={target.changesetId} />;
    case 'range':
      return (
        <div className={styles.title}>
          Changes from <code>{target.fromSpec}</code> to <code>{target.toSpec}</code>
        </div>
      );
    case 'branch':
      return <div className={styles.title}>All changes on {target.branch}</div>;
    case 'shelve':
      return <div className={styles.title}>Shelve {target.shelveId}</div>;
  }
}

function ChangesetDescription({ changesetId }: { changesetId: number }) {
  const { data: changeset } = useChangeset(changesetId);
  return changeset ? <ChangesetSummary changeset={changeset} /> : <div className={styles.title}>Changeset {changesetId}</div>;
}
