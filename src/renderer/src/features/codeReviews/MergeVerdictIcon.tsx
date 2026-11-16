import { Check, CircleDot, X, type LucideIcon } from 'lucide-react';
import type { MergeVerdict } from './mergeVerdict';
import { VERDICT_WORDS } from './mergeVerdict';
import styles from './MergeVerdictIcon.module.css';

/** The verdicts' icons: the merge card's discs' (a check, a cross, a quiet dot while it waits). */
const VERDICT_ICONS: Record<MergeVerdict, LucideIcon> = { ready: Check, blocked: X, waiting: CircleDot };

/** Whether a merge request can merge, by a branch's name: the merge card's verdict, named by its tooltip. */
export function MergeVerdictIcon({ verdict }: { verdict: MergeVerdict }) {
  const Icon = VERDICT_ICONS[verdict];
  return (
    <span className={styles.icon} data-verdict={verdict} role="img" aria-label={VERDICT_WORDS[verdict]} data-tip={VERDICT_WORDS[verdict]}>
      <Icon size={13} strokeWidth={verdict === 'waiting' ? 2 : 2.5} aria-hidden />
    </span>
  );
}
