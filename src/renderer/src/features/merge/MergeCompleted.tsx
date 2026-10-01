import { CheckCircle2 } from 'lucide-react';
import type { MergeRequest } from '@shared/domain/merge';
import { navigation } from '../../app/navigation/navigationStore';
import { Button } from '../../ui/Button';
import { completionCounts, completionTitle, mergeTitle, mergeTitleText, type MergeLabels } from './mergeDescription';
import styles from './MergeCompleted.module.css';

/** What the merge page keeps once the merge ran, when the plan it showed is gone. */
export interface MergeCompletion {
  labels: MergeLabels;
  changeCount: number;
  conflictCount: number;
}

/**
 * The end of a merge into the workspace, stated plainly: the result waits in the pending changes. A merge into a
 * server branch has nothing left to do and goes back instead (`completeMerge`).
 */
export function MergeCompleted({ request, completion }: { request: MergeRequest; completion: MergeCompletion }) {
  const { labels, changeCount, conflictCount } = completion;
  const counts = completionCounts(changeCount, conflictCount);

  return (
    <div className={styles.completed}>
      <span className={styles.icon}>
        <CheckCircle2 size={24} />
      </span>
      <h1 className={styles.title}>{completionTitle(request)}</h1>
      <p className={styles.what}>{mergeTitleText(mergeTitle(request, labels.destination))}</p>
      <p className={styles.next}>The result is in your pending changes, ready to check in.</p>
      {counts && <p className={styles.counts}>{counts}</p>}
      <div className={styles.actions}>
        <Button onClick={navigation.goBack}>Close</Button>
        <Button variant="primary" onClick={() => navigation.goToView('changes')}>
          Review and check in
        </Button>
      </div>
    </div>
  );
}
