import { useMemo, useRef, useState, type DragEvent, type HTMLAttributes } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import type { SelectionState } from '../../lib/selection';
import { isControlled } from './changeCategories';
import { changelistHeadersOf, changesToMove, dragFromRow } from './changelistMoves';
import type { ChangeRow } from './changeRows';

/** Data type of a drag carrying selected changes; the changes themselves stay in a ref, since only this list reads them. */
const CHANGES_DRAG_TYPE = 'application/x-uvcs-pending-changes';

interface ChangelistDropOptions {
  rows: ChangeRow[];
  selection: SelectionState;
  onSelectionChange: (selection: SelectionState) => void;
  selectedChanges: () => PendingChange[];
  /** Rows only take drops when this is set. */
  onMoveToChangelist?: (changes: PendingChange[], changelist: string | null) => void;
}

/**
 * Dragging the selected changes onto a changelist, its header or any row in it, moves them into that changelist, as in
 * the official client.
 */
export function useChangelistDrop({ rows, selection, onSelectionChange, selectedChanges, onMoveToChangelist }: ChangelistDropOptions) {
  const dragged = useRef<PendingChange[] | null>(null);
  // The key of the header of the changelist the changes would go into.
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const takesDrops = onMoveToChangelist !== undefined;
  const headers = useMemo(() => changelistHeadersOf(takesDrops ? rows : []), [rows, takesDrops]);

  const endDrag = (): void => {
    dragged.current = null;
    setDropTarget(null);
  };

  const dragProps = (row: ChangeRow): HTMLAttributes<HTMLElement> => {
    if (!onMoveToChangelist || row.type !== 'change' || !isControlled(row.change)) return {};
    return {
      draggable: true,
      onDragStart: (event: DragEvent) => {
        const drag = dragFromRow(row, selection, selectedChanges);
        if (drag.select) onSelectionChange(drag.select);
        dragged.current = drag.changes;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData(CHANGES_DRAG_TYPE, String(dragged.current.length));
      },
      onDragEnd: endDrag,
    };
  };

  const dropProps = (row: ChangeRow): HTMLAttributes<HTMLElement> => {
    const header = headers.get(row.key);
    if (!onMoveToChangelist || !header) return {};
    const target = header.changelist?.name ?? null;
    return {
      onDragOver: (event: DragEvent) => {
        if (!dragged.current) return;
        // Over the changelist the changes are already in, nothing moves: no drop, and no changelist lit.
        if (changesToMove(dragged.current, target).length === 0) {
          setDropTarget(null);
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDropTarget(header.key);
      },
      onDrop: (event: DragEvent) => {
        event.preventDefault();
        if (dragged.current) onMoveToChangelist(changesToMove(dragged.current, target), target);
        endDrag();
      },
    };
  };

  // Only leaving the list puts the changelist out: going from one of its rows to the next doesn't make it flicker.
  const listDropProps: HTMLAttributes<HTMLElement> = {
    onDragLeave: (event: DragEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null);
    },
  };

  /** Whether the row is in the changelist the dragged changes would go into, its header included. */
  const isInDropTarget = (row: ChangeRow): boolean => dropTarget !== null && headers.get(row.key)?.key === dropTarget;

  return { dragProps, dropProps, listDropProps, isInDropTarget };
}
