import { useDialogStore } from '../../ui/dialog/dialogStore';
import { useSession } from '../workspace/sessionStore';
import { useOpenWorkspace } from '../workspace/useOpenWorkspace';
import { droppedItems, readDroppedFolder } from './droppedFolder';
import { openDroppedFolder } from './openDroppedFolder';
import { useFolderDrop } from './useFolderDrop';
import { FolderDropOverlay } from './FolderDropOverlay';

/**
 * Dropping a folder anywhere on the window, on the home screen or a workspace, opens its workspace here (with Shift, in
 * a new window), or offers to create a workspace in it. Drops wait while a dialog is open.
 */
export function FolderDropTarget() {
  const openHere = useOpenWorkspace();
  const dialogOpen = useDialogStore((state) => state.dialogs.length > 0);
  const drag = useFolderDrop({
    accepting: () => useDialogStore.getState().dialogs.length === 0,
    onDrop: (dataTransfer, shiftKey) => {
      const dropped = readDroppedFolder(droppedItems(dataTransfer, window.uvcs.pathForFile));
      void openDroppedFolder(dropped, { newWindow: shiftKey, currentWorkspace: useSession.getState().workspacePath, openHere });
    },
  });

  return <FolderDropOverlay visible={drag.isOver && !dialogOpen} newWindow={drag.newWindow} />;
}
