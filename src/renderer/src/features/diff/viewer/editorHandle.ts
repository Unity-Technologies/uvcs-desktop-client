/** What the viewer does with the text typed into a diff, through the editor that holds it. */
export interface EditorHandle {
  /** Replaces the text as one edit, which ⌘Z undoes like typing. */
  setText: (text: string) => void;
  undo: () => void;
  /** Puts the caret back where it was, or on the first line in view. */
  focus: () => void;
  hasFocus: () => boolean;
}
