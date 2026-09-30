import { useDialogStore } from '../../ui/dialog/dialogStore';
import { useSession } from '../workspace/sessionStore';
import { useOpenWorkspace } from '../workspace/useOpenWorkspace';
import { droppedItems, readDroppedFolder } from './droppedFolder';
import { dropIntentOf, dropOverlayWording } from './dropOverlayWording';
import { openDroppedFolder } from './openDroppedFolder';
import { useDraggedFolder } from './useDraggedFolder';
import { useFolderDrop } from './useFolderDrop';
import { FolderDropOverlay } from './FolderDropOverlay';

/**
 * Dropping a folder anywhere on the window, on the home screen or a workspace, opens its workspace here (with Shift, in
 * a new window), or offers to create a workspace in it. Drops wait while a dialog is open. While the drag runs, the
 * overlay says which will happen when main can tell (`system.draggedFolder`, macOS only).
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

  const visible = drag.isOver && !dialogOpen;
  // A guess for the words only: the drop decides on the dropped path (`openDroppedFolder`).
  const draggedFolder = useDraggedFolder(visible);

  return <FolderDropOverlay visible={visible} wording={dropOverlayWording(dropIntentOf(draggedFolder), drag.newWindow)} />;
}
