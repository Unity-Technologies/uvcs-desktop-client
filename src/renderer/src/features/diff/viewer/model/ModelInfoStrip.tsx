import type { ModelStat } from './modelStats';
import styles from './ModelInfoStrip.module.css';

/** The model's figures, bottom left: each once, as before → after where it changed. */
export function ModelInfoStrip({ stats }: { stats: ModelStat[] }) {
  return (
    <div className={styles.strip}>
      {stats.map((stat) => {
        const changed = stat.before !== null && stat.after !== null && stat.before !== stat.after;
        return (
          <span key={stat.label} className={styles.stat} data-changed={changed || undefined} data-tip={stat.tip}>
            <span className={styles.label}>{stat.label}</span>
            {changed ? (
              <>
                <span data-side="old">{stat.before}</span>
                <span className={styles.arrow}>→</span>
                <span data-side="new">{stat.after}</span>
              </>
            ) : (
              <span>{stat.after ?? stat.before}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}
