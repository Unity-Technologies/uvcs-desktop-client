import { ChevronDown, Undo2 } from 'lucide-react';
import { useMemo, type CSSProperties } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { SEPARATOR } from '../../lib/actions';
import { formatCount, pluralize } from '../../lib/text';
import { Checkbox, type CheckState } from '../../ui/Checkbox';
import { IconButton } from '../../ui/IconButton';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { isCheckinCandidate, isControlled } from './changeCategories';
import styles from './ChangesSummaryBar.module.css';

interface ChangesSummaryBarProps {
  /** The changes the filter lets through. */
  changes: PendingChange[];
  totalCount: number;
  isIncluded: (change: PendingChange) => boolean;
  onSetIncluded: (changes: PendingChange[], included: boolean) => void;
  onUndo: (changes: PendingChange[]) => void;
  onUndoUnchanged: () => void;
  /** Lines the checkbox up with the list's top-level checkboxes when rows have a chevron before theirs. */
  checkboxInset: number;
}

/** Above the list: include or exclude every shown change, how many there are, and the ways to undo them. */
export function ChangesSummaryBar({ changes, totalCount, isIncluded, onSetIncluded, onUndo, onUndoUnchanged, checkboxInset }: ChangesSummaryBarProps) {
  const { candidates, includedCount, undoable } = useMemo(() => {
    const candidates = changes.filter(isCheckinCandidate);
    return { candidates, includedCount: candidates.filter(isIncluded).length, undoable: changes.filter(isControlled) };
  }, [changes, isIncluded]);
  const checkState: CheckState = includedCount === 0 ? false : includedCount === candidates.length ? true : 'mixed';
  const filtered = changes.length !== totalCount;
  const undoAllLabel = filtered ? `Undo the ${formatCount(undoable.length)} shown changes` : 'Undo all changes';

  return (
    <div className={styles.bar} style={{ '--checkbox-inset': `${checkboxInset}px` } as CSSProperties}>
      <Checkbox checked={checkState} disabled={candidates.length === 0} onChange={(checked) => onSetIncluded(candidates, checked)} />
      <span className={styles.label}>
        {filtered ? `${formatCount(changes.length)} of ${formatCount(totalCount)}` : pluralize(totalCount, 'file')}
      </span>
      <div className={styles.undo}>
        <IconButton
          size="small"
          className={styles.undoMain}
          icon={<Undo2 size={13} />}
          label={undoAllLabel}
          disabled={undoable.length === 0}
          onClick={() => onUndo(undoable)}
        />
        <ActionDropdownMenu
          entries={[
            { id: 'undoUnchanged', label: 'Undo unchanged checkouts', icon: Undo2, run: onUndoUnchanged },
            SEPARATOR,
            { id: 'undoAll', label: `${undoAllLabel}…`, icon: Undo2, danger: true, disabled: undoable.length === 0, run: () => onUndo(undoable) },
          ]}
        >
          <IconButton size="small" className={styles.undoMore} icon={<ChevronDown size={12} />} label="More ways to undo" />
        </ActionDropdownMenu>
      </div>
    </div>
  );
}
