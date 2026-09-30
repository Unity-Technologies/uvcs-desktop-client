import type { WorkspaceSelector } from '@shared/domain/workspace';
import { classNames } from '../lib/classNames';
import { Highlight } from '../ui/Highlight';
import { selectorChip } from './workingObject';
import styles from './WorkspaceChip.module.css';

/** What a workspace is on: a branch by its last segment, a changeset, label or shelve by its name; the full name in its tooltip. */
export function SelectorChip({ selector, className }: { selector: WorkspaceSelector; className?: string }) {
  const { icon: KindIcon, text, tip, tipSub } = selectorChip(selector);
  return (
    <span className={classNames(styles.chip, className)} data-tip={tip} data-tip-sub={tipSub}>
      <KindIcon size={11} />
      <span className={styles.text}>
        <Highlight text={text} />
      </span>
    </span>
  );
}
