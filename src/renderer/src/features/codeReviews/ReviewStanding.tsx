import type { MergeRequestSummary } from './mergeRequestSummary';
import { MergeCardDisc } from './MergeCardDisc';
import { ReviewDetailLine } from './ReviewDetailLine';
import styles from './ReviewStanding.module.css';

/** Where a merge request's review stands, as its merge card says it: the verdict's disc, the title, the detail with the review's icon. */
export function ReviewStanding({ standing }: { standing: NonNullable<MergeRequestSummary['review']> }) {
  return (
    <div className={styles.standing}>
      <MergeCardDisc section={standing} size="small" />
      <div className={styles.text}>
        <p className={styles.title}>{standing.title}</p>
        {standing.detail && <ReviewDetailLine className={styles.detail} detail={standing.detail} status={standing.status} />}
      </div>
    </div>
  );
}
