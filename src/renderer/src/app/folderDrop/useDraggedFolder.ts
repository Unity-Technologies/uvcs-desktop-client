import { useEffect, useState } from 'react';
import type { DraggedFolder } from '@shared/api/system';
import { api } from '../../api/client';

/**
 * The folder being dragged over the window, asked once per drag as it arrives (`system.draggedFolder`); undefined
 * until main answers, null when it can't tell. An answer arriving after its drag ended is dropped.
 */
export function useDraggedFolder(dragging: boolean): DraggedFolder | null | undefined {
  const [folder, setFolder] = useState<DraggedFolder | null | undefined>(undefined);

  useEffect(() => {
    // Forgotten as the drag ends, so the next one never starts with this one's words.
    if (!dragging) {
      setFolder(undefined);
      return;
    }
    let current = true;
    api.system.draggedFolder().then(
      (answer) => current && setFolder(answer),
      () => current && setFolder(null),
    );
    return () => {
      current = false;
    };
  }, [dragging]);

  return folder;
}
