import { useState, type DragEvent } from 'react';
import { api } from '../../api/client';
import { confirm } from '../../ui/dialog/confirm';
import { openCreateWorkspaceDialog } from './dialogs/CreateWorkspaceDialog';

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

  const openDroppedFolder = async (folder: string): Promise<void> => {
    const workspaceRoot = await api.workspaces.findRoot(folder);
    if (workspaceRoot) {
      openWorkspace(workspaceRoot);
      return;
    }
    const create = await confirm({
      title: 'This folder is not a workspace',
      message: `Create a workspace in ${folder} to version its files?`,
      confirmLabel: 'Create workspace…',
    });
    if (create) openCreateWorkspaceDialog({ path: folder, onCreated: openWorkspace });
  };

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
      if (file) void openDroppedFolder(window.uvcs.pathForFile(file));
    },
  };
}
