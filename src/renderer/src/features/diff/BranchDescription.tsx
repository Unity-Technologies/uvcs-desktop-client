import { PathLabel } from '../../components/PathLabel';
import styles from './TargetDiff.module.css';

/** A branch's diff, whole or changeset by changeset: the same header in both, so switching moves nothing. */
export function BranchDescription({ branch }: { branch: string }) {
  return (
    <div className={styles.branchTitle}>
      <span>All changes on</span>
      <PathLabel path={branch} fitContent />
    </div>
  );
}
