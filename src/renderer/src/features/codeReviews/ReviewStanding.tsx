import type { MergeRequestSummary } from './mergeRequestSummary';
import { MergeCardDisc } from './MergeCardDisc';
import styles from './ReviewStanding.module.css';

/** Where a merge request's review stands, as its merge card says it: the verdict's disc, then the title and its detail. */
export function ReviewStanding({ standing }: { standing: NonNullable<MergeRequestSummary['review']> }) {
  return (
    <div className={styles.standing}>
      <MergeCardDisc section={standing} size="small" />
      <div className={styles.text}>
        <p className={styles.title}>{standing.title}</p>
        {standing.detail && <p className={styles.detail}>{standing.detail}</p>}
      </div>
    </div>
  );
}
