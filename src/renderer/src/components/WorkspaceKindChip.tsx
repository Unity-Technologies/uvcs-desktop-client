import type { WorkspaceKind } from '@shared/domain/workspace';
import { classNames } from '../lib/classNames';
import { workspaceKindChip } from './workspaceKindWords';
import styles from './WorkspaceChip.module.css';

/** A partial or dynamic workspace's kind, explained in its tooltip; nothing for a standard one (`workspaceKindChip`). */
export function WorkspaceKindChip({ kind, className }: { kind: WorkspaceKind | undefined; className?: string }) {
  const chip = workspaceKindChip(kind);
  if (!chip) return null;
  return (
    <span className={classNames(styles.chip, styles.kind, className)} data-tip={chip.description}>
      {chip.label}
    </span>
  );
}
