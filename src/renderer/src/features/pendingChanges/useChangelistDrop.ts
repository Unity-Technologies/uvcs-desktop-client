import { useRef, useState, type DragEvent, type HTMLAttributes } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import type { SelectionState } from '../../lib/selection';
import { isControlled } from './changeCategories';
import { changesToMove } from './changelistMoves';
import type { ChangeRow } from './changeRows';

/** Data type of a drag carrying selected changes; the changes themselves stay in a ref, since only this list reads them. */
const CHANGES_DRAG_TYPE = 'application/x-uvcs-pending-changes';

interface ChangelistDropOptions {
  selection: SelectionState;
  onSelectionChange: (selection: SelectionState) => void;
  selectedChanges: () => PendingChange[];
  /** Changelist headers only take drops when this is set. */
  onMoveToChangelist?: (changes: PendingChange[], changelist: string | null) => void;
}

/** Dragging the selected changes onto a changelist header moves them into that changelist. */
export function useChangelistDrop({ selection, onSelectionChange, selectedChanges, onMoveToChangelist }: ChangelistDropOptions) {
  const dragged = useRef<PendingChange[] | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const endDrag = (): void => {
    dragged.current = null;
    setDropTarget(null);
  };

  const dragProps = (row: ChangeRow): HTMLAttributes<HTMLElement> => {
    if (!onMoveToChangelist || row.type !== 'change' || !isControlled(row.change)) return {};
    return {
      draggable: true,
      onDragStart: (event: DragEvent) => {
        const inSelection = selection.selected.has(row.key);
        if (!inSelection) onSelectionChange({ selected: new Set([row.key]), anchor: row.key });
        dragged.current = (inSelection ? selectedChanges() : [row.change]).filter(isControlled);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData(CHANGES_DRAG_TYPE, String(dragged.current.length));
      },
      onDragEnd: endDrag,
    };
  };

  const dropProps = (row: ChangeRow): HTMLAttributes<HTMLElement> => {
    if (!onMoveToChangelist || row.type !== 'group') return {};
    const target = row.changelist?.name ?? null;
    return {
      onDragOver: (event: DragEvent) => {
        if (!dragged.current || changesToMove(dragged.current, target).length === 0) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDropTarget(row.key);
      },
      onDragLeave: (event: DragEvent) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null);
      },
      onDrop: (event: DragEvent) => {
        event.preventDefault();
        if (dragged.current) onMoveToChangelist(changesToMove(dragged.current, target), target);
        endDrag();
      },
    };
  };

  return { dragProps, dropProps, dropTarget };
}
