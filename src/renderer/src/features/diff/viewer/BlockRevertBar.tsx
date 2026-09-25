import { Undo2 } from 'lucide-react';
import type { ChangeBlock } from './changeBlocks';
import styles from './BlockRevertBar.module.css';

/** A slim bar above each change block of a workspace file's diff: how much it changes, and a way to take it back. */
export function BlockRevertBar({ block, onRevert }: { block: ChangeBlock; onRevert: () => void }) {
  return (
    <div className={styles.bar}>
      <span className={styles.stat}>
        {block.newLines > 0 && <span className={styles.added}>+{block.newLines}</span>}
        {block.oldLines > 0 && <span className={styles.removed}>−{block.oldLines}</span>}
      </span>
      <button type="button" className={styles.revert} onClick={onRevert} data-tip="Put these lines back as they were in the original">
        <Undo2 size={11} />
        Revert this block
      </button>
    </div>
  );
}
