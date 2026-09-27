import { AGE_BUCKETS } from './annotationAge';
import styles from './AgeLegend.module.css';

/** "Older ▭▭▭▭▭ Newer": the shades of the age strip, in the annotation's toolbar. */
export function AgeLegend() {
  return (
    <div className={styles.legend} data-toolbar-extra data-tip="How recent each block is among the changesets of the file">
      <span>Older</span>
      <span className={styles.scale}>
        {Array.from({ length: AGE_BUCKETS }, (_, index) => (
          <span key={index} className={styles.swatch} style={{ background: `var(--annotate-age-${index + 1})` }} />
        ))}
      </span>
      <span>Newer</span>
    </div>
  );
}
