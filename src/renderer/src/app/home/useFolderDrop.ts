import { useState, type DragEvent } from 'react';
import { openFolder } from '../workspace/openWorkspaceFolder';

interface FolderDropHandlers {
  isDraggingOver: boolean;
  onDragOver: (event: DragEvent) => void;
  onDragLeave: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
}

/**
 * Dropping a folder opens the workspace it belongs to, or offers to create a workspace there.
 */
export function useFolderDrop(openWorkspace: (path: string) => void): FolderDropHandlers {
  const [isDraggingOver, setDraggingOver] = useState(false);

  return {
    isDraggingOver,
    onDragOver: (event) => {
      if (!event.dataTransfer.types.includes('Files')) return;
      event.preventDefault();
      setDraggingOver(true);
    },
    onDragLeave: (event) => {
      if (event.currentTarget === event.target) setDraggingOver(false);
    },
    onDrop: (event) => {
      event.preventDefault();
      setDraggingOver(false);
      const file = event.dataTransfer.files[0];
      if (file) void openFolder(window.uvcs.pathForFile(file), openWorkspace);
    },
  };
}
