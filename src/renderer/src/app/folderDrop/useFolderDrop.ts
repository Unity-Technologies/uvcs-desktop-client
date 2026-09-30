import { useEffect, useReducer, useRef } from 'react';
import { isFileDrag, isFolderDragOver, nextFolderDragState, NO_FOLDER_DRAG, type FolderDragState } from './folderDragState';

/**
 * Follows drags of files from the file manager over the whole window (`folderDragState` says how) and hands a drop to
 * `onDrop`. Listening on the window, not an element, keeps every drop from navigating the page to the dropped file.
 */
export function useFolderDrop(onDrop: (event: DragEvent) => void): FolderDragState & { isOver: boolean } {
  const [state, dispatch] = useReducer(nextFolderDragState, NO_FOLDER_DRAG);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  useEffect(() => {
    const handles = (event: DragEvent): boolean => Boolean(event.dataTransfer && isFileDrag([...event.dataTransfer.types]));
    const onDragEnter = (event: DragEvent): void => {
      if (handles(event)) dispatch({ type: 'enter', shiftKey: event.shiftKey });
    };
    const onDragOver = (event: DragEvent): void => {
      if (!handles(event)) return;
      event.preventDefault();
      dispatch({ type: 'over', shiftKey: event.shiftKey });
    };
    const onDragLeave = (event: DragEvent): void => {
      if (handles(event)) dispatch({ type: 'leave', leftWindow: event.relatedTarget === null });
    };
    const onDropEvent = (event: DragEvent): void => {
      if (!handles(event)) return;
      event.preventDefault();
      dispatch({ type: 'end' });
      onDropRef.current(event);
    };
    const end = (): void => dispatch({ type: 'end' });

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDropEvent);
    window.addEventListener('dragend', end);
    window.addEventListener('pointermove', end);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDropEvent);
      window.removeEventListener('dragend', end);
      window.removeEventListener('pointermove', end);
    };
  }, []);

  return { ...state, isOver: isFolderDragOver(state) };
}
