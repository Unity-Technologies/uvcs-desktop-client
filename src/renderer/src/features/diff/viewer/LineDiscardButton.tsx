import { Undo2, X } from 'lucide-react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import { regionContaining, type ChangedLine, type ChangeRegion } from './changeBlocks';
import { describeDiscard } from './discardAction';
import styles from './DiscardChip.module.css';

/** The changed line under the pointer, if any. */
export type HoveredLineStore = StoreApi<ChangedLine | null>;

interface DiscardChipProps {
  hovered: HoveredLineStore;
  regions: ChangeRegion[];
  /** The lines the chip would discard while the pointer is on it, to preview the result. */
  onPreview: (lines: ChangedLine[] | null) => void;
  onDiscard: (lines: ChangedLine[]) => void;
}

/** Shown in the gutter of the changed line under the pointer: discards that line's whole change. */
export function DiscardChip({ hovered, regions, onPreview, onDiscard }: DiscardChipProps) {
  const line = useStore(hovered);
  const lines = line ? regionContaining(regions, line)?.lines : undefined;
  if (!lines) return null;

  const action = describeDiscard(lines);
  return (
    <div className={styles.slot}>
      <button
        type="button"
        className={styles.chip}
        data-kind={action.kind}
        data-tip={action.kind === 'revert' ? 'Revert this change' : action.label}
        data-tip-sub={action.description}
        aria-label={action.label}
        onPointerEnter={() => onPreview(lines)}
        onPointerLeave={() => onPreview(null)}
        onClick={() => onDiscard(lines)}
      >
        {action.kind === 'remove' ? <X size={12} strokeWidth={2.25} /> : <Undo2 size={12} strokeWidth={2.25} />}
      </button>
    </div>
  );
}
