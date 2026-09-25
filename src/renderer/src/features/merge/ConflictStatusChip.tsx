import { Check, CircleAlert, Ellipsis, PencilLine, Sparkles, type LucideIcon } from 'lucide-react';
import type { MergeLabels } from './mergeDescription';
import { presentStatus, type ConflictStatus } from './mergeStatus';
import styles from './ConflictStatusChip.module.css';

const ICONS: Record<ConflictStatus, LucideIcon> = {
  reading: Ellipsis,
  unreadable: CircleAlert,
  automatic: Sparkles,
  needsDecision: CircleAlert,
  keepingDestination: Check,
  keepingSource: Check,
  keepingBoth: Check,
  combined: Check,
  edited: PencilLine,
};

interface ConflictStatusChipProps {
  status: ConflictStatus;
  labels: MergeLabels;
  /** Replaces the standard explanation, e.g. with what a directory conflict is about. */
  explanation?: string;
}

/** Where a conflict stands, the same in the list and in the file's header; its tooltip explains it. */
export function ConflictStatusChip({ status, labels, explanation }: ConflictStatusChipProps) {
  const presentation = presentStatus(status, labels);
  const Icon = ICONS[status];
  return (
    <span className={styles.chip} data-tone={presentation.tone} data-tip={explanation ?? presentation.explanation}>
      <Icon size={11} strokeWidth={2.4} />
      {presentation.label}
    </span>
  );
}
