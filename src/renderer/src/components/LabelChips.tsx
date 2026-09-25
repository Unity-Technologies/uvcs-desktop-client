import { Tag } from 'lucide-react';
import type { Label } from '@shared/domain/label';
import { Highlight } from '../ui/Highlight';
import styles from './LabelChips.module.css';

/** Chips shown before the rest collapse into "+N". */
const MAX_CHIPS = 2;

/** The labels on a changeset as small chips for list rows; past two, the rest collapse into "+N" with their names in its tooltip. */
export function LabelChips({ labels }: { labels: readonly Label[] | undefined }) {
  if (!labels || labels.length === 0) return null;
  const shown = labels.slice(0, MAX_CHIPS);
  const rest = labels.slice(MAX_CHIPS);

  return (
    <span className={styles.chips}>
      {shown.map((label) => (
        <span key={label.id} className={styles.chip} data-tip={label.comment ? `Label ${label.name}` : undefined} data-tip-sub={label.comment || undefined}>
          <Tag size={9} strokeWidth={2.5} />
          <Highlight text={label.name} />
        </span>
      ))}
      {rest.length > 0 && (
        <span className={styles.chip} data-tip={rest.map((label) => label.name).join(', ')}>
          +{rest.length}
        </span>
      )}
    </span>
  );
}
