import styles from './SinceReviewDot.module.css';

/** Before a file's name: it changed since it was reviewed. */
export function SinceReviewDot() {
  return <span className={styles.dot} data-tip="Changed since you reviewed it" />;
}
