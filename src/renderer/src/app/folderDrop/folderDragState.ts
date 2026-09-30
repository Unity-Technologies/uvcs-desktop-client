/**
 * Where a drag of files from outside the app stands over the window, kept from its DOM drag events.
 *
 * `dragenter` and `dragleave` fire for every element the pointer crosses, the new element's enter before the old one's
 * leave, so the drag is over the window while more elements were entered than left (`depth`). Three things end it for
 * sure, in case an enter and its leave don't pair up (an element unmounted under the pointer never sends its leave):
 * a `dragleave` towards nothing (`relatedTarget` null: the pointer left the window, or Escape cancelled the drag), a
 * drop or `dragend`, and any pointer move, as the page gets no pointer events while a drag is on.
 */
export interface FolderDragState {
  /** Elements entered minus elements left; the drag is over the window while it's above zero. */
  depth: number;
  /** Shift is held: the dropped folder's workspace opens in a new window. */
  newWindow: boolean;
}

export const NO_FOLDER_DRAG: FolderDragState = { depth: 0, newWindow: false };

export type FolderDragEvent =
  | { type: 'enter'; shiftKey: boolean }
  | { type: 'over'; shiftKey: boolean }
  | { type: 'leave'; leftWindow: boolean }
  /** A drop, a `dragend`, or a pointer move: no drag is on anymore. */
  | { type: 'end' };

/** The state after a drag event; the same object when nothing changed, so React skips the render. */
export function nextFolderDragState(state: FolderDragState, event: FolderDragEvent): FolderDragState {
  switch (event.type) {
    case 'enter':
      return { depth: state.depth + 1, newWindow: event.shiftKey };
    case 'over':
      // A drag already over the window when the page started listening sends no enter: its first `dragover` counts as one.
      if (state.depth > 0 && state.newWindow === event.shiftKey) return state;
      return { depth: Math.max(state.depth, 1), newWindow: event.shiftKey };
    case 'leave':
      if (event.leftWindow || state.depth <= 1) return NO_FOLDER_DRAG;
      return { ...state, depth: state.depth - 1 };
    case 'end':
      return state.depth === 0 ? state : NO_FOLDER_DRAG;
  }
}

export function isFolderDragOver(state: FolderDragState): boolean {
  return state.depth > 0;
}

/** Only drags carrying files from the file manager (`Files`) are drops of folders; the app's own drags carry other types. */
export function isFileDrag(types: readonly string[]): boolean {
  return types.includes('Files');
}
