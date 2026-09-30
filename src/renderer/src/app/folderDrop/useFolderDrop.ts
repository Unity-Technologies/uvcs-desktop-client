import { useEffect, useReducer, useRef } from 'react';
import { isFileDrag, isFolderDragOver, nextFolderDragState, NO_FOLDER_DRAG, type FolderDragState } from './folderDragState';

interface FolderDropOptions {
  /** False while drops wait (a dialog is open): the drag shows it can't drop, and a drop does nothing. */
  accepting: () => boolean;
  /** Called while the drop event is dispatched, the only time its items can be read. */
  onDrop: (dataTransfer: DataTransfer, shiftKey: boolean) => void;
}

/**
 * Follows drags of files from the file manager over the whole window (`folderDragState` says how) and hands a drop to
 * `onDrop`. Listening on the window, not an element, keeps every drop from navigating the page to the dropped file.
 */
export function useFolderDrop(options: FolderDropOptions): FolderDragState & { isOver: boolean } {
  const [state, dispatch] = useReducer(nextFolderDragState, NO_FOLDER_DRAG);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const handles = (event: DragEvent): event is DragEvent & { dataTransfer: DataTransfer } =>
      Boolean(event.dataTransfer && isFileDrag([...event.dataTransfer.types]));
    const onDragEnter = (event: DragEvent): void => {
      if (handles(event)) dispatch({ type: 'enter', shiftKey: event.shiftKey });
    };
    const onDragOver = (event: DragEvent): void => {
      if (!handles(event)) return;
      event.preventDefault();
      if (!optionsRef.current.accepting()) event.dataTransfer.dropEffect = 'none';
      dispatch({ type: 'over', shiftKey: event.shiftKey });
    };
    const onDragLeave = (event: DragEvent): void => {
      if (handles(event)) dispatch({ type: 'leave', leftWindow: event.relatedTarget === null });
    };
    const onDrop = (event: DragEvent): void => {
      if (!handles(event)) return;
      event.preventDefault();
      dispatch({ type: 'end' });
      if (optionsRef.current.accepting()) optionsRef.current.onDrop(event.dataTransfer, event.shiftKey);
    };
    const end = (): void => dispatch({ type: 'end' });

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    window.addEventListener('dragend', end);
    window.addEventListener('pointermove', end);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('dragend', end);
      window.removeEventListener('pointermove', end);
    };
  }, []);

  return { ...state, isOver: isFolderDragOver(state) };
}
