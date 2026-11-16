import { Check, X } from 'lucide-react';
import type { MergeVerdict } from './mergeVerdict';
import { VERDICT_WORDS } from './mergeVerdict';
import styles from './MergeVerdictIcon.module.css';

/** Whether a merge request can merge, by a branch's name: the merge card's verdict (a check, a cross), named by its tooltip. */
export function MergeVerdictIcon({ verdict }: { verdict: MergeVerdict }) {
  const Icon = verdict === 'ready' ? Check : X;
  return (
    <span className={styles.icon} data-verdict={verdict} role="img" aria-label={VERDICT_WORDS[verdict]} data-tip={VERDICT_WORDS[verdict]}>
      <Icon size={13} strokeWidth={2.5} aria-hidden />
    </span>
  );
}
