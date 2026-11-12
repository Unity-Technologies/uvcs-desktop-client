import { PathLabel } from '../../components/PathLabel';
import styles from './TargetDiff.module.css';

/** A branch's diff, all its changes or some of its changesets: the same header for each, so picking moves nothing. */
export function BranchDescription({ branch }: { branch: string }) {
  return (
    <div className={styles.branchTitle}>
      <span>All changes on</span>
      <PathLabel path={branch} fitContent />
    </div>
  );
}
