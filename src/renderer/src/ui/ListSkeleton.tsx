import styles from './ListSkeleton.module.css';

const ROWS = 12;

/** Placeholder rows shaped like a table while a list loads, so the view keeps its structure instead of going blank. */
export function ListSkeleton() {
  return (
    <div className={styles.list} aria-busy="true" aria-label="Loading">
      {Array.from({ length: ROWS }, (_, index) => (
        <div key={index} className={styles.row}>
          <span className={styles.name} />
          <span className={styles.comment} />
          <span className={styles.meta} />
        </div>
      ))}
    </div>
  );
}
