import { CheckCircle2 } from 'lucide-react';
import type { MergeRequest, MergeResult } from '@shared/domain/merge';
import { navigation } from '../../app/navigation/navigationStore';
import { Button } from '../../ui/Button';
import { completionTitle, mergeTitle, mergeTitleText, type MergeLabels } from './mergeDescription';
import styles from './MergeCompleted.module.css';

/** What the merge page keeps once the merge ran, when the plan it showed is gone. */
export interface MergeCompletion {
  result: MergeResult;
  labels: MergeLabels;
  changeCount: number;
  conflictCount: number;
}

/** The end of a merge, stated plainly: where the result went, and what's left to do with it. */
export function MergeCompleted({ request, completion }: { request: MergeRequest; completion: MergeCompletion }) {
  const { result, labels, changeCount, conflictCount } = completion;
  const intoServerBranch = Boolean(request.destinationBranch);
  const counts = [
    `${changeCount} ${changeCount === 1 ? 'change' : 'changes'} applied`,
    conflictCount > 0 && `${conflictCount} ${conflictCount === 1 ? 'conflict' : 'conflicts'} resolved`,
  ].filter(Boolean);

  return (
    <div className={styles.completed}>
      <span className={styles.icon}>
        <CheckCircle2 size={24} />
      </span>
      <h1 className={styles.title}>{completionTitle(request)}</h1>
      <p className={styles.what}>{mergeTitleText(mergeTitle(request, labels.destination))}</p>
      <p className={styles.next}>
        {intoServerBranch
          ? `Created changeset ${result.changesetId} on ${labels.destination}. Your workspace didn't change.`
          : 'The result is in your workspace as pending changes. Nothing is checked in yet: review them in Changes, then check in to record the merge.'}
      </p>
      <p className={styles.counts}>{counts.join(' · ')}</p>
      <div className={styles.actions}>
        {intoServerBranch ? (
          <Button variant="primary" onClick={navigation.goBack}>
            Done
          </Button>
        ) : (
          <>
            <Button onClick={navigation.goBack}>Close</Button>
            <Button variant="primary" onClick={() => navigation.goToView('changes')}>
              Review and check in
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
