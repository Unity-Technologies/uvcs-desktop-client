import { PathLabel } from '../../components/PathLabel';
import type { ChangesetListChoice } from '../../components/changesetList/changesetListChoice';
import { branchDiffHeading } from './branchDiffHeading';
import styles from './TargetDiff.module.css';

/**
 * A branch's diff, all its changes or some of its changesets: one line naming what shows and the branch
 * (`branchDiffHeading`), as tall for each, so picking moves nothing. `choice`: what its list of changesets selects;
 * none for the branch's own diff.
 */
export function BranchDescription({ branch, choice = { kind: 'all' } }: { branch: string; choice?: ChangesetListChoice }) {
  return (
    <div className={styles.branchTitle}>
      <span className={styles.branchLead}>{branchDiffHeading(choice)}</span>
      <PathLabel path={branch} fitContent />
    </div>
  );
}
