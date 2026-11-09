import styles from './IssueTrackerPane.module.css';

/** A quiet way past the sign-in already there: signing in with another account instead (`signInStepFor`). */
export function DifferentAccountLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className={styles.textLink} onClick={onClick}>
      Use a different account
    </button>
  );
}
