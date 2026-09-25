import { AppWindow, Check, CircleAlert, Ellipsis, PencilLine, Sparkles, type LucideIcon } from 'lucide-react';
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
  resolvedInTool: Check,
  openInTool: AppWindow,
};

interface ConflictStatusChipProps {
  status: ConflictStatus;
  labels: MergeLabels;
  /** Replaces the standard explanation, e.g. with what a directory conflict is about. */
  explanation?: string;
  /** The merge tool the file is open in, or was resolved in. */
  tool?: string;
  /** Just the icon, its label in the tooltip: in the list, where the file's header says it in words. */
  compact?: boolean;
}

/** Where a conflict stands: a chip in the file's header, an icon in the list; its tooltip explains it. */
export function ConflictStatusChip({ status, labels, explanation, tool, compact = false }: ConflictStatusChipProps) {
  const presentation = presentStatus(status, labels, tool);
  const Icon = ICONS[status];
  const tip = explanation ?? presentation.explanation;
  if (compact) {
    return (
      <span className={styles.icon} data-tone={presentation.tone} data-tip={presentation.label} data-tip-sub={tip} role="img" aria-label={presentation.label}>
        <Icon size={13} strokeWidth={2.2} />
      </span>
    );
  }
  return (
    <span className={styles.chip} data-tone={presentation.tone} data-tip={tip}>
      <Icon size={11} strokeWidth={2.4} />
      <span data-chip-label>{presentation.label}</span>
    </span>
  );
}
